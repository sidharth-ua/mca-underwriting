import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { mapDDVCategory, isDDVFormat } from '@/utils/parsing/ddvCategoryMapper'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_TYPES = [
  'application/pdf',
  'text/csv',
  'application/vnd.ms-excel',
  'text/plain', // Some CSVs come as text/plain
]

// POST /api/upload - Upload a PDF or CSV file for a deal
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const dealId = formData.get('dealId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!dealId) {
      return NextResponse.json({ error: 'Deal ID is required' }, { status: 400 })
    }

    // Check file extension for CSV files that might have wrong mime type
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    const isCSV = fileExtension === 'csv'
    const isPDF = fileExtension === 'pdf'

    // Validate file type
    if (!isCSV && !isPDF) {
      return NextResponse.json(
        { error: 'Only PDF and CSV files are allowed' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size must be less than 50MB' },
        { status: 400 }
      )
    }

    // Check if deal exists
    const deal = await prisma.deal.findUnique({ where: { id: dealId } })
    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    // Generate unique filename
    const uniqueFilename = `${randomUUID()}.${fileExtension}`

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'uploads', dealId)
    await mkdir(uploadsDir, { recursive: true })

    // Save file to disk
    const filePath = join(uploadsDir, uniqueFilename)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Create document record
    const document = await prisma.document.create({
      data: {
        dealId,
        filename: uniqueFilename,
        originalName: file.name,
        mimeType: isCSV ? 'text/csv' : 'application/pdf',
        size: file.size,
        status: 'UPLOADED',
        filePath: filePath,
      },
    })

    // Update deal status to processing if it's new
    if (deal.status === 'NEW') {
      await prisma.deal.update({
        where: { id: dealId },
        data: { status: 'PROCESSING' },
      })
    }

    // Log activity
    await prisma.dealActivity.create({
      data: {
        dealId,
        userId: session.user.id,
        action: 'DOCUMENT_UPLOADED',
        details: `Uploaded ${isCSV ? 'CSV' : 'PDF'} file: ${file.name}`,
      },
    })

    // Process based on file type
    if (isCSV) {
      // Parse CSV immediately and store transactions
      const csvContent = buffer.toString('utf-8')
      await processTaggedCSV(document.id, csvContent, dealId, session.user.id)
    } else {
      // Trigger mock PDF processing
      simulateDocumentProcessing(document.id)
    }

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}

// Parse tagged CSV and store transactions
async function processTaggedCSV(
  documentId: string,
  csvContent: string,
  dealId: string,
  userId: string
) {
  try {
    // Update status to parsing
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'PARSING' },
    })

    // Parse CSV - handle different line endings
    const lines = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(line => line.trim())
    if (lines.length < 2) {
      throw new Error('CSV file is empty or has no data rows')
    }

    // Parse headers (first row) - normalize by removing quotes and extra spaces
    const rawHeaders = parseCSVLine(lines[0])
    const headers = rawHeaders.map(h => h.toLowerCase().trim().replace(/['"]/g, '').replace(/\s+/g, '_'))

    console.log('CSV Headers found:', headers)
    console.log('First data row:', parseCSVLine(lines[1]))

    // Find column indices - support DDV format and common formats
    const dateIdx = findColumnIndex(headers, [
      'posted', 'date', 'transaction_date', 'trans_date', 'posting_date', 'post_date',
      'txn_date', 'value_date', 'posted_date', 'effective_date'
    ])
    const descIdx = findColumnIndex(headers, [
      'transaction_description', 'description', 'desc', 'memo', 'narrative',
      'details', 'particulars', 'narration', 'transaction_memo', 'remarks',
      'transaction_details', 'payee', 'merchant'
    ])
    const amountIdx = findColumnIndex(headers, [
      'amount', 'transaction_amount', 'trans_amount', 'value', 'sum',
      'txn_amount', 'transaction_value'
    ])
    const debitIdx = findColumnIndex(headers, [
      'debit', 'debit_amount', 'withdrawal', 'withdrawals', 'debit_amt',
      'money_out', 'outflow', 'expense', 'dr', 'dr_amount', 'payment'
    ])
    const creditIdx = findColumnIndex(headers, [
      'credit', 'credit_amount', 'deposit', 'deposits', 'credit_amt',
      'money_in', 'inflow', 'income', 'cr', 'cr_amount', 'receipt'
    ])
    const balanceIdx = findColumnIndex(headers, [
      'balance', 'running_balance', 'ledger_balance', 'available_balance',
      'closing_balance', 'end_balance', 'account_balance', 'bal'
    ])
    // DDV format uses 'tag' for detailed tag and 'tag_category' for category
    const tagIdx = findColumnIndex(headers, ['tag'])
    const tagCategoryIdx = findColumnIndex(headers, ['tag_category'])
    const categoryIdx = tagCategoryIdx >= 0 ? tagCategoryIdx : findColumnIndex(headers, [
      'category', 'type', 'transaction_type', 'trans_type',
      'txn_type', 'classification', 'class', 'label'
    ])
    const subcategoryIdx = tagIdx >= 0 ? tagIdx : findColumnIndex(headers, [
      'subcategory', 'sub_category', 'subtag', 'sub_type'
    ])

    console.log('Column indices:', { dateIdx, descIdx, amountIdx, debitIdx, creditIdx, balanceIdx, categoryIdx })

    // Validate that we have at least date and some amount info
    if (dateIdx === -1) {
      console.error('Could not find date column. Available headers:', headers)
      // Try to guess - first column is often date
      if (headers.length > 0) {
        console.log('Attempting to use first column as date')
      }
    }

    // Determine bank info from filename or first few rows
    const bankName = extractBankName(csvContent, headers)
    const accountNumber = extractAccountNumber(csvContent, headers)

    // Create bank account
    const bankAccount = await prisma.bankAccount.create({
      data: {
        documentId,
        bankName: bankName || 'Imported Bank Account',
        accountNumber: accountNumber || '****0000',
        accountType: 'CHECKING',
        startDate: new Date(),
        endDate: new Date(),
      },
    })

    // Update status to tagging
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'TAGGING' },
    })

    // Parse data rows
    const transactions: Array<{
      bankAccountId: string
      date: Date
      description: string
      amount: number
      type: 'CREDIT' | 'DEBIT'
      runningBalance: number
      category: string | null
      subcategory: string | null
    }> = []

    let minDate = new Date()
    let maxDate = new Date(0)
    let runningBalance = 0

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      if (values.length < 2) continue // Skip invalid rows

      try {
        // Parse date - try specified column first, then fallbacks
        let date: Date | null = null
        let dateStr = ''

        if (dateIdx >= 0) {
          dateStr = values[dateIdx] || ''
          date = parseDate(dateStr)
        }

        // If no date column found or parsing failed, try to find a date in any column
        if (!date) {
          for (let j = 0; j < Math.min(values.length, 5); j++) {
            const possibleDate = parseDate(values[j])
            if (possibleDate) {
              date = possibleDate
              dateStr = values[j]
              break
            }
          }
        }

        if (!date) {
          console.warn(`Row ${i}: Could not parse date from:`, values.slice(0, 3))
          continue
        }

        // Track date range
        if (date < minDate) minDate = date
        if (date > maxDate) maxDate = date

        // Parse description - try specified column first, then find longest text field
        let description = descIdx >= 0 ? values[descIdx]?.trim() || '' : ''

        if (!description) {
          // Find the column with the longest text (likely description)
          let maxLen = 0
          for (let j = 0; j < values.length; j++) {
            const val = values[j]?.trim() || ''
            // Skip if it looks like a number or date
            if (val && val.length > maxLen && !/^[\d$.,\-\/]+$/.test(val) && !parseDate(val)) {
              description = val
              maxLen = val.length
            }
          }
        }

        // Parse amount - handle both single amount column and separate debit/credit columns
        let amount = 0
        let type: 'CREDIT' | 'DEBIT' = 'CREDIT'

        if (amountIdx >= 0) {
          const amtStr = values[amountIdx]?.replace(/[$,()]/g, '').trim() || '0'
          amount = Math.abs(parseFloat(amtStr) || 0)
          // Negative amounts or amounts in parentheses are debits
          type = amtStr.startsWith('-') || values[amountIdx]?.includes('(') || parseFloat(amtStr) < 0 ? 'DEBIT' : 'CREDIT'
        } else if (debitIdx >= 0 || creditIdx >= 0) {
          const debitStr = debitIdx >= 0 ? values[debitIdx]?.replace(/[$,()]/g, '').trim() || '' : ''
          const creditStr = creditIdx >= 0 ? values[creditIdx]?.replace(/[$,()]/g, '').trim() || '' : ''
          const debitAmt = Math.abs(parseFloat(debitStr) || 0)
          const creditAmt = Math.abs(parseFloat(creditStr) || 0)

          if (debitAmt > 0) {
            amount = debitAmt
            type = 'DEBIT'
          } else if (creditAmt > 0) {
            amount = creditAmt
            type = 'CREDIT'
          }
        } else {
          // No amount column found - try to find numeric values
          for (let j = 0; j < values.length; j++) {
            const val = values[j]?.replace(/[$,()]/g, '').trim() || ''
            const num = parseFloat(val)
            if (!isNaN(num) && Math.abs(num) > 0 && Math.abs(num) < 10000000) {
              amount = Math.abs(num)
              type = val.startsWith('-') || values[j]?.includes('(') || num < 0 ? 'DEBIT' : 'CREDIT'
              break
            }
          }
        }

        if (amount === 0) continue // Skip zero amount transactions

        // Parse balance
        if (balanceIdx >= 0) {
          const balStr = values[balanceIdx]?.replace(/[$,]/g, '').trim() || '0'
          runningBalance = parseFloat(balStr) || runningBalance
        } else {
          // Calculate running balance
          runningBalance = type === 'CREDIT' ? runningBalance + amount : runningBalance - amount
        }

        // Parse category - use DDV mapper if DDV format detected
        const rawTagCategory = categoryIdx >= 0 ? values[categoryIdx]?.trim() : null
        const rawTag = subcategoryIdx >= 0 ? values[subcategoryIdx]?.trim() : null

        let category: string | null = null
        let subcategory: string | null = rawTag

        // Check if this is DDV format and use the specialized mapper
        if (rawTagCategory && isDDVFormat(rawTagCategory)) {
          const mappingResult = mapDDVCategory(rawTagCategory, rawTag, type)
          category = mappingResult.normalizedCategory
          // Store the detailed tag as subcategory for MCA name extraction later
          subcategory = rawTag
        } else {
          // Fall back to legacy normalizeCategory for non-DDV formats
          category = rawTagCategory ? normalizeCategory(rawTagCategory) : null
        }

        transactions.push({
          bankAccountId: bankAccount.id,
          date,
          description,
          amount,
          type,
          runningBalance,
          category,
          subcategory,
        })
      } catch (rowError) {
        console.warn(`Error parsing row ${i}:`, rowError)
        continue
      }
    }

    if (transactions.length === 0) {
      throw new Error('No valid transactions found in CSV')
    }

    // Update bank account date range
    await prisma.bankAccount.update({
      where: { id: bankAccount.id },
      data: {
        startDate: minDate,
        endDate: maxDate,
      },
    })

    // Batch create transactions
    await prisma.transaction.createMany({
      data: transactions,
    })

    // Update document status to ready
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'READY' },
    })

    // Log activity
    await prisma.dealActivity.create({
      data: {
        dealId,
        userId,
        action: 'CSV_PROCESSED',
        details: `Imported ${transactions.length} transactions from CSV`,
      },
    })

    // Check if all documents are ready and update deal status
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { documents: true },
    })

    if (deal) {
      const allReady = deal.documents.every(doc => doc.status === 'READY')
      if (allReady && deal.status === 'PROCESSING') {
        await prisma.deal.update({
          where: { id: dealId },
          data: { status: 'READY' },
        })
      }
    }

    console.log(`Successfully processed CSV: ${transactions.length} transactions imported`)
  } catch (error) {
    console.error('Error processing CSV:', error)
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'ERROR' },
    })
  }
}

// Helper: Parse a CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())

  return result
}

// Helper: Find column index from multiple possible names
function findColumnIndex(headers: string[], possibleNames: string[]): number {
  for (const name of possibleNames) {
    const idx = headers.indexOf(name)
    if (idx >= 0) return idx
  }
  return -1
}

// Helper: Parse date from various formats
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null

  const trimmed = dateStr.trim().replace(/['"]/g, '')
  if (!trimmed) return null

  // Try DDV format first: "MM DD YY" (space-separated with 2-digit year)
  const ddvMatch = trimmed.match(/^(\d{1,2})\s+(\d{1,2})\s+(\d{2})$/)
  if (ddvMatch) {
    const year = parseInt(ddvMatch[3])
    const fullYear = year >= 50 ? 1900 + year : 2000 + year
    const d = new Date(fullYear, parseInt(ddvMatch[1]) - 1, parseInt(ddvMatch[2]))
    if (!isNaN(d.getTime())) return d
  }

  // Try ISO format (YYYY-MM-DD)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) {
    const d = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]))
    if (!isNaN(d.getTime())) return d
  }

  // Try MM/DD/YYYY or M/D/YYYY format (common US format)
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (usMatch) {
    const d = new Date(parseInt(usMatch[3]), parseInt(usMatch[1]) - 1, parseInt(usMatch[2]))
    if (!isNaN(d.getTime())) return d
  }

  // Try MM-DD-YYYY or M-D-YYYY format
  const usDashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (usDashMatch) {
    const d = new Date(parseInt(usDashMatch[3]), parseInt(usDashMatch[1]) - 1, parseInt(usDashMatch[2]))
    if (!isNaN(d.getTime())) return d
  }

  // Try DD/MM/YYYY format (European)
  const euMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (euMatch) {
    // Check if day > 12 to determine if it's DD/MM/YYYY
    if (parseInt(euMatch[1]) > 12) {
      const d = new Date(parseInt(euMatch[3]), parseInt(euMatch[2]) - 1, parseInt(euMatch[1]))
      if (!isNaN(d.getTime())) return d
    }
  }

  // Try MM/DD/YY or M/D/YY format
  const shortYearMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
  if (shortYearMatch) {
    const year = parseInt(shortYearMatch[3])
    const fullYear = year >= 50 ? 1900 + year : 2000 + year
    const d = new Date(fullYear, parseInt(shortYearMatch[1]) - 1, parseInt(shortYearMatch[2]))
    if (!isNaN(d.getTime())) return d
  }

  // Try text format like "Jan 15, 2024" or "January 15, 2024"
  const textMatch = trimmed.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/)
  if (textMatch) {
    const monthNames: Record<string, number> = {
      jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
      apr: 3, april: 3, may: 4, jun: 5, june: 5,
      jul: 6, july: 6, aug: 7, august: 7, sep: 8, september: 8,
      oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
    }
    const monthNum = monthNames[textMatch[1].toLowerCase()]
    if (monthNum !== undefined) {
      const d = new Date(parseInt(textMatch[3]), monthNum, parseInt(textMatch[2]))
      if (!isNaN(d.getTime())) return d
    }
  }

  // Try "15 Jan 2024" or "15-Jan-2024" format
  const dayFirstMatch = trimmed.match(/^(\d{1,2})[\s-](\w+)[\s-](\d{4})$/)
  if (dayFirstMatch) {
    const monthNames: Record<string, number> = {
      jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
      apr: 3, april: 3, may: 4, jun: 5, june: 5,
      jul: 6, july: 6, aug: 7, august: 7, sep: 8, september: 8,
      oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
    }
    const monthNum = monthNames[dayFirstMatch[2].toLowerCase()]
    if (monthNum !== undefined) {
      const d = new Date(parseInt(dayFirstMatch[3]), monthNum, parseInt(dayFirstMatch[1]))
      if (!isNaN(d.getTime())) return d
    }
  }

  // Last resort: try native Date parsing
  const nativeDate = new Date(trimmed)
  if (!isNaN(nativeDate.getTime()) && nativeDate.getFullYear() >= 1990 && nativeDate.getFullYear() <= 2100) {
    return nativeDate
  }

  console.warn('Could not parse date:', dateStr)
  return null
}

// Helper: Normalize category names - handles DDV format "Income - X" / "Expense - X"
function normalizeCategory(category: string | undefined): string | null {
  if (!category) return null

  const trimmed = category.trim().replace(/['"]/g, '')
  if (!trimmed || trimmed === '99.UNASSIGNED') return null

  // Handle DDV format: "Income - Category" or "Expense - Category"
  const ddvMatch = trimmed.match(/^(Income|Expense)\s*-\s*(.+)$/i)
  if (ddvMatch) {
    const type = ddvMatch[1].toLowerCase()
    const cat = ddvMatch[2].toLowerCase().trim()

    // Map DDV categories to standard names
    if (cat.includes('mca repayment') || cat.includes('mca -')) {
      return 'mca_payment'
    }
    if (cat.includes('mca disbursal')) {
      return 'mca_funding'
    }
    if (cat.includes('bank fees') || cat.includes('overdraft')) {
      return 'nsf_fee'
    }
    if (cat.includes('rent')) {
      return 'rent'
    }
    if (cat.includes('software') || cat.includes('subscriptions')) {
      return 'software_subscriptions'
    }
    if (cat.includes('travel') || cat.includes('entertainment')) {
      return 'travel_entertainment'
    }
    if (cat.includes('professional') || cat.includes('legal')) {
      return 'professional_services'
    }
    if (cat.includes('utilities') || cat.includes('telecom')) {
      return 'utilities'
    }
    if (cat.includes('credit card') || cat.includes('pmts to credit')) {
      return 'credit_card_payment'
    }
    if (cat.includes('zelle') && type === 'income') {
      return 'zelle_income'
    }
    if (cat.includes('zelle') && type === 'expense') {
      return 'zelle_expense'
    }
    if (cat.includes('settlement')) {
      return 'settlement'
    }
    if (cat.includes('personal')) {
      return 'personal_expense'
    }
    if (cat.includes('business')) {
      return 'business_expense'
    }
    if (cat.includes('payroll') || cat.includes('salary')) {
      return 'payroll'
    }
    if (cat.includes('counselling') || cat.includes('counseling')) {
      return 'revenue_counseling'
    }

    // Return normalized form
    return cat.replace(/\s+/g, '_').replace(/-/g, '_')
  }

  const lower = trimmed.toLowerCase()

  // Map common category variations to standard names
  const categoryMap: Record<string, string> = {
    'revenue': 'revenue',
    'income': 'revenue',
    'deposit': 'ach_deposit',
    'ach deposit': 'ach_deposit',
    'ach credit': 'ach_deposit',
    'card': 'card_processing',
    'card processing': 'card_processing',
    'credit card': 'card_processing',
    'pos': 'card_processing',
    'mca': 'mca_payment',
    'mca payment': 'mca_payment',
    'merchant cash advance': 'mca_payment',
    'daily debit': 'mca_payment',
    'loan': 'loan_payment',
    'loan payment': 'loan_payment',
    'rent': 'rent',
    'lease': 'rent',
    'payroll': 'payroll',
    'salary': 'payroll',
    'wages': 'payroll',
    'utilities': 'utilities',
    'utility': 'utilities',
    'electric': 'utilities',
    'gas': 'utilities',
    'water': 'utilities',
    'nsf': 'nsf_fee',
    'overdraft': 'nsf_fee',
    'insufficient funds': 'nsf_fee',
    'returned item': 'nsf_fee',
    'fee': 'bank_fee',
    'bank fee': 'bank_fee',
    'service charge': 'bank_fee',
    'insurance': 'insurance',
    'tax': 'taxes',
    'taxes': 'taxes',
    'irs': 'taxes',
    'vendor': 'vendor_payment',
    'supplier': 'vendor_payment',
    'expense': 'expense',
    'owner draw': 'owner_draw',
    'owner withdrawal': 'owner_draw',
    'transfer': 'transfer',
    'wire': 'wire_transfer',
    'wire transfer': 'wire_transfer',
  }

  return categoryMap[lower] || lower.replace(/\s+/g, '_')
}

// Helper: Extract bank name from CSV content
function extractBankName(content: string, headers: string[]): string | null {
  // Check for bank name in headers
  const bankIdx = headers.indexOf('bank') >= 0 ? headers.indexOf('bank') :
                  headers.indexOf('bank_name') >= 0 ? headers.indexOf('bank_name') : -1

  if (bankIdx >= 0) {
    const firstDataLine = content.split('\n')[1]
    if (firstDataLine) {
      const values = parseCSVLine(firstDataLine)
      if (values[bankIdx]) return values[bankIdx]
    }
  }

  // Try to detect from content
  const contentLower = content.toLowerCase()
  if (contentLower.includes('chase')) return 'Chase Bank'
  if (contentLower.includes('bank of america') || contentLower.includes('bofa')) return 'Bank of America'
  if (contentLower.includes('wells fargo')) return 'Wells Fargo'
  if (contentLower.includes('citibank') || contentLower.includes('citi')) return 'Citibank'
  if (contentLower.includes('capital one')) return 'Capital One'
  if (contentLower.includes('pnc')) return 'PNC Bank'
  if (contentLower.includes('us bank')) return 'US Bank'
  if (contentLower.includes('td bank')) return 'TD Bank'

  return null
}

// Helper: Extract account number from CSV content
function extractAccountNumber(content: string, headers: string[]): string | null {
  const accIdx = headers.indexOf('account') >= 0 ? headers.indexOf('account') :
                 headers.indexOf('account_number') >= 0 ? headers.indexOf('account_number') :
                 headers.indexOf('account_no') >= 0 ? headers.indexOf('account_no') : -1

  if (accIdx >= 0) {
    const firstDataLine = content.split('\n')[1]
    if (firstDataLine) {
      const values = parseCSVLine(firstDataLine)
      if (values[accIdx]) {
        // Mask account number for security
        const acc = values[accIdx]
        return acc.length > 4 ? '****' + acc.slice(-4) : acc
      }
    }
  }

  return null
}

// Simulate document processing for PDFs (mock vendor integration)
async function simulateDocumentProcessing(documentId: string) {
  setTimeout(async () => {
    try {
      // Update to parsing status
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'PARSING' },
      })

      // Simulate parsing delay (2-3 seconds)
      await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 1000))

      // Create mock bank account
      const bankAccount = await prisma.bankAccount.create({
        data: {
          documentId,
          bankName: 'Mock Bank of America',
          accountNumber: '****' + Math.floor(1000 + Math.random() * 9000),
          accountType: 'CHECKING',
          startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          endDate: new Date(),
        },
      })

      // Update to parsed status
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'PARSED' },
      })

      // Simulate tagging delay
      await new Promise((resolve) => setTimeout(resolve, 1000))

      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'TAGGING' },
      })

      // Create mock transactions
      const transactionTypes = ['CREDIT', 'DEBIT'] as const
      const categories = [
        'card_processing',
        'ach_deposit',
        'mca_payment',
        'rent',
        'payroll',
        'utilities',
        'nsf_fee',
      ]

      const transactions = []
      let balance = 50000 + Math.random() * 50000

      for (let i = 0; i < 90; i++) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        const numTransactions = Math.floor(1 + Math.random() * 5)

        for (let j = 0; j < numTransactions; j++) {
          const type = transactionTypes[Math.floor(Math.random() * 2)]
          const amount = Math.floor(100 + Math.random() * 5000)
          const category = categories[Math.floor(Math.random() * categories.length)]

          if (type === 'CREDIT') {
            balance += amount
          } else {
            balance -= amount
          }

          transactions.push({
            bankAccountId: bankAccount.id,
            date,
            description: `Mock ${category.replace('_', ' ')} transaction`,
            amount,
            type,
            runningBalance: Math.max(0, balance),
            category,
            subcategory: null,
          })
        }
      }

      // Batch create transactions
      await prisma.transaction.createMany({
        data: transactions,
      })

      // Update to ready status
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'READY' },
      })

      // Get deal and check if all documents are ready
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: { deal: { include: { documents: true } } },
      })

      if (document?.deal) {
        const allReady = document.deal.documents.every(
          (doc) => doc.status === 'READY'
        )

        if (allReady && document.deal.status === 'PROCESSING') {
          await prisma.deal.update({
            where: { id: document.dealId },
            data: { status: 'READY' },
          })
        }
      }
    } catch (error) {
      console.error('Error in document processing simulation:', error)
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'ERROR' },
      })
    }
  }, 500)
}
