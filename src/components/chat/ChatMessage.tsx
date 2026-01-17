'use client'

import { Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatMessageProps {
  message: Message
  className?: string
}

export function ChatMessage({ message, className }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn(
      'flex gap-3',
      isUser ? 'justify-end' : 'justify-start',
      className
    )}>
      {!isUser && (
        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
          <Bot className="h-4 w-4 text-blue-600" />
        </div>
      )}

      <div className={cn(
        'max-w-[75%] rounded-2xl px-4 py-3',
        isUser
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-900'
      )}>
        <div className="text-sm leading-relaxed">
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            <FormattedContent content={message.content} />
          )}
        </div>
        <div className={cn(
          'text-xs mt-2',
          isUser ? 'text-blue-200' : 'text-gray-400'
        )}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {isUser && (
        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-1">
          <User className="h-4 w-4 text-white" />
        </div>
      )}
    </div>
  )
}

function FormattedContent({ content }: { content: string }) {
  if (!content) {
    return <span className="text-gray-400 italic">Thinking...</span>
  }

  // Simple markdown-like parsing
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let currentList: string[] = []
  let listType: 'ul' | 'ol' | null = null

  const flushList = () => {
    if (currentList.length > 0 && listType) {
      const ListTag = listType === 'ul' ? 'ul' : 'ol'
      elements.push(
        <ListTag key={`list-${elements.length}`} className={cn(
          'my-2 space-y-1',
          listType === 'ul' ? 'list-disc pl-4' : 'list-decimal pl-4'
        )}>
          {currentList.map((item, i) => (
            <li key={i}>{highlightText(item)}</li>
          ))}
        </ListTag>
      )
      currentList = []
      listType = null
    }
  }

  lines.forEach((line, index) => {
    // Headers
    if (line.startsWith('### ')) {
      flushList()
      elements.push(
        <h4 key={index} className="font-semibold text-gray-900 mt-3 mb-1 text-sm">
          {highlightText(line.slice(4))}
        </h4>
      )
      return
    }
    if (line.startsWith('## ')) {
      flushList()
      elements.push(
        <h3 key={index} className="font-semibold text-gray-900 mt-3 mb-1">
          {highlightText(line.slice(3))}
        </h3>
      )
      return
    }
    if (line.startsWith('# ')) {
      flushList()
      elements.push(
        <h2 key={index} className="font-bold text-gray-900 mt-3 mb-2">
          {highlightText(line.slice(2))}
        </h2>
      )
      return
    }

    // Horizontal rule
    if (line.match(/^-{3,}$/)) {
      flushList()
      elements.push(<hr key={index} className="my-3 border-gray-300" />)
      return
    }

    // Unordered list
    if (line.match(/^[\s]*[-*]\s/)) {
      if (listType !== 'ul') {
        flushList()
        listType = 'ul'
      }
      currentList.push(line.replace(/^[\s]*[-*]\s/, ''))
      return
    }

    // Ordered list
    if (line.match(/^[\s]*\d+\.\s/)) {
      if (listType !== 'ol') {
        flushList()
        listType = 'ol'
      }
      currentList.push(line.replace(/^[\s]*\d+\.\s/, ''))
      return
    }

    // Empty line
    if (line.trim() === '') {
      flushList()
      elements.push(<div key={index} className="h-2" />)
      return
    }

    // Regular paragraph
    flushList()
    elements.push(
      <p key={index} className="my-1">
        {highlightText(line)}
      </p>
    )
  })

  flushList()

  return <>{elements}</>
}

function highlightText(text: string): React.ReactNode {
  // Process **bold** first
  const boldParts = text.split(/\*\*(.*?)\*\*/g)
  const withBold = boldParts.map((part, i) =>
    i % 2 === 1 ? <strong key={`bold-${i}`} className="font-semibold">{part}</strong> : part
  )

  // For each text part, process highlights
  const processText = (content: string, keyPrefix: string): React.ReactNode[] => {
    const result: React.ReactNode[] = []

    // Combine all patterns: currency, percentages, and risk terms
    const riskTerms = ['NSF', 'MCA', 'stacking', 'overdraft', 'red flag', 'critical', 'high risk']
    const combinedPattern = new RegExp(
      `(\\$[\\d,]+(?:\\.\\d{2})?[KMB]?)|` + // currency
      `(\\d+(?:\\.\\d+)?%)|` + // percentages
      `(${riskTerms.join('|')})`, // risk terms
      'gi'
    )

    let lastIndex = 0
    let match: RegExpExecArray | null
    let matchIndex = 0

    while ((match = combinedPattern.exec(content)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        result.push(content.slice(lastIndex, match.index))
      }

      const matchedText = match[0]

      // Determine which type of match it is
      if (match[1]) {
        // Currency
        result.push(
          <span key={`${keyPrefix}-curr-${matchIndex}`} className="font-semibold text-blue-600">
            {matchedText}
          </span>
        )
      } else if (match[2]) {
        // Percentage
        result.push(
          <span key={`${keyPrefix}-pct-${matchIndex}`} className="font-medium text-purple-600">
            {matchedText}
          </span>
        )
      } else if (match[3]) {
        // Risk term
        result.push(
          <span key={`${keyPrefix}-risk-${matchIndex}`} className="font-medium text-red-600">
            {matchedText}
          </span>
        )
      }

      lastIndex = match.index + matchedText.length
      matchIndex++
    }

    // Add remaining text
    if (lastIndex < content.length) {
      result.push(content.slice(lastIndex))
    }

    return result.length > 0 ? result : [content]
  }

  const finalResult = withBold.map((part, i) => {
    if (typeof part === 'string') {
      return processText(part, `part-${i}`)
    }
    return part
  })

  return <>{finalResult}</>
}
