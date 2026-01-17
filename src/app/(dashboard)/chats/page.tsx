'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageSquare, Send, Loader2, Building2, Download, BarChart2, Trash2, ChevronDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DealContextPanel } from '@/components/chat/DealContextPanel'
import { SuggestedQuestions } from '@/components/chat/SuggestedQuestions'
import { ChatMessage } from '@/components/chat/ChatMessage'
import type { DealChatContext } from '@/types/chat'

interface Deal {
  id: string
  merchantName: string
  status: string
  createdAt: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function ChatsPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loadingDeals, setLoadingDeals] = useState(true)
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)
  const [showDealSelector, setShowDealSelector] = useState(false)
  const [dealSearchQuery, setDealSearchQuery] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dealSelectorRef = useRef<HTMLDivElement>(null)

  // Context panel state
  const [dealContext, setDealContext] = useState<DealChatContext | null>(null)
  const [loadingContext, setLoadingContext] = useState(false)
  const [contextPanelCollapsed, setContextPanelCollapsed] = useState(false)

  // Close deal selector when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dealSelectorRef.current && !dealSelectorRef.current.contains(event.target as Node)) {
        setShowDealSelector(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch deals on mount
  useEffect(() => {
    fetchDeals()
  }, [])

  // Load chat history and context when deal is selected
  useEffect(() => {
    if (selectedDealId) {
      loadChatHistory(selectedDealId)
      fetchDealContext(selectedDealId)
    } else {
      setMessages([])
      setDealContext(null)
    }
  }, [selectedDealId])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when deal is selected
  useEffect(() => {
    if (selectedDealId && inputRef.current) {
      inputRef.current.focus()
    }
  }, [selectedDealId])

  const fetchDeals = async () => {
    setLoadingDeals(true)
    try {
      const response = await fetch('/api/deals')
      if (response.ok) {
        const data = await response.json()
        setDeals(data.deals || data)
      }
    } catch (error) {
      console.error('Error fetching deals:', error)
    } finally {
      setLoadingDeals(false)
    }
  }

  const fetchDealContext = async (dealId: string) => {
    setLoadingContext(true)
    try {
      const response = await fetch(`/api/deals/${dealId}/context`)
      if (response.ok) {
        const data = await response.json()
        setDealContext(data)
      }
    } catch (error) {
      console.error('Error fetching deal context:', error)
    } finally {
      setLoadingContext(false)
    }
  }

  const loadChatHistory = async (dealId: string) => {
    try {
      const response = await fetch(`/api/deals/${dealId}/chat/history`)
      if (response.ok) {
        const history = await response.json()
        setMessages(history.map((m: { id: string; role: string; content: string; timestamp: string }) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        })))
      }
    } catch (error) {
      console.error('Error loading chat history:', error)
    }
  }

  const saveChatMessages = async (dealId: string, newMessages: Message[]) => {
    try {
      await fetch(`/api/deals/${dealId}/chat/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp.toISOString()
          }))
        })
      })
    } catch (error) {
      console.error('Error saving chat history:', error)
    }
  }

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming || !selectedDealId) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsStreaming(true)

    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, assistantMessage])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId: selectedDealId,
          message: userMessage.content,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      })

      if (!response.ok) {
        throw new Error('Chat request failed')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No reader available')

      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                fullContent += parsed.delta.text
                setMessages(prev => {
                  const updated = [...prev]
                  const lastIndex = updated.length - 1
                  if (updated[lastIndex]?.role === 'assistant') {
                    updated[lastIndex] = {
                      ...updated[lastIndex],
                      content: fullContent
                    }
                  }
                  return updated
                })
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      // Save both messages to history
      const finalAssistantMessage = { ...assistantMessage, content: fullContent }
      await saveChatMessages(selectedDealId, [userMessage, finalAssistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => {
        const updated = [...prev]
        const lastIndex = updated.length - 1
        if (updated[lastIndex]?.role === 'assistant') {
          updated[lastIndex] = {
            ...updated[lastIndex],
            content: 'Sorry, an error occurred. Please check your API key configuration and try again.'
          }
        }
        return updated
      })
    } finally {
      setIsStreaming(false)
    }
  }, [input, isStreaming, selectedDealId, messages])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSuggestedQuestion = (question: string) => {
    setInput(question)
    inputRef.current?.focus()
  }

  const handleExportChat = () => {
    if (!selectedDeal || messages.length === 0) return

    const content = `# Chat Analysis: ${selectedDeal.merchantName}

Generated: ${new Date().toLocaleString()}
Deal ID: ${selectedDealId}

---

${messages.map(m => `## ${m.role === 'user' ? 'Underwriter' : 'AI Analyst'}

${m.content}

*${m.timestamp.toLocaleString()}*

---
`).join('\n')}
`
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedDeal.merchantName.replace(/\s+/g, '_')}_chat_${new Date().toISOString().split('T')[0]}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleViewScorecard = () => {
    if (selectedDealId) {
      window.open(`/deals/${selectedDealId}`, '_blank')
    }
  }

  const handleClearChat = async () => {
    if (!selectedDealId) return

    try {
      await fetch(`/api/deals/${selectedDealId}/chat/history`, {
        method: 'DELETE'
      })
      setMessages([])
    } catch (error) {
      console.error('Error clearing chat:', error)
    }
  }

  const filteredDeals = deals.filter(deal =>
    deal.merchantName.toLowerCase().includes(dealSearchQuery.toLowerCase())
  )

  const selectedDeal = deals.find(d => d.id === selectedDealId)

  return (
    <div className="h-[calc(100vh-7rem)] flex rounded-lg border bg-white shadow-sm overflow-hidden">
      {/* Chat Area - Main Panel (no left sidebar) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header with Deal Selector */}
        <div className="px-4 py-3 border-b bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Deal Selector Dropdown */}
              <div className="relative" ref={dealSelectorRef}>
                <button
                  onClick={() => setShowDealSelector(!showDealSelector)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors',
                    'hover:bg-gray-50',
                    selectedDealId ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    selectedDealId ? 'bg-blue-100' : 'bg-gray-200'
                  )}>
                    <Building2 className={cn(
                      'h-4 w-4',
                      selectedDealId ? 'text-blue-600' : 'text-gray-500'
                    )} />
                  </div>
                  <div className="text-left">
                    <p className={cn(
                      'font-medium text-sm',
                      selectedDealId ? 'text-gray-900' : 'text-gray-500'
                    )}>
                      {selectedDeal?.merchantName || 'Select a deal'}
                    </p>
                    {selectedDeal && (
                      <p className="text-xs text-gray-500">
                        {selectedDeal.status}
                      </p>
                    )}
                  </div>
                  <ChevronDown className={cn(
                    'h-4 w-4 text-gray-400 transition-transform',
                    showDealSelector && 'rotate-180'
                  )} />
                </button>

                {/* Dropdown */}
                {showDealSelector && (
                  <div className="absolute top-full left-0 mt-1 w-80 bg-white border rounded-lg shadow-lg z-50 overflow-hidden">
                    {/* Search */}
                    <div className="p-2 border-b">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search deals..."
                          value={dealSearchQuery}
                          onChange={(e) => setDealSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Deals List */}
                    <div className="max-h-64 overflow-y-auto">
                      {loadingDeals ? (
                        <div className="p-4 text-center">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                        </div>
                      ) : filteredDeals.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          No deals found
                        </div>
                      ) : (
                        filteredDeals.map(deal => (
                          <button
                            key={deal.id}
                            onClick={() => {
                              setSelectedDealId(deal.id)
                              setShowDealSelector(false)
                              setDealSearchQuery('')
                            }}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                              'hover:bg-gray-50',
                              deal.id === selectedDealId && 'bg-blue-50'
                            )}
                          >
                            <div className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                              deal.id === selectedDealId ? 'bg-blue-100' : 'bg-gray-100'
                            )}>
                              <Building2 className={cn(
                                'h-4 w-4',
                                deal.id === selectedDealId ? 'text-blue-600' : 'text-gray-500'
                              )} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-gray-900 truncate">
                                {deal.merchantName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(deal.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <span className={cn(
                              'text-xs px-2 py-0.5 rounded-full flex-shrink-0',
                              deal.status === 'READY' ? 'bg-green-100 text-green-700' :
                              deal.status === 'PROCESSING' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-600'
                            )}>
                              {deal.status}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {selectedDeal && (
                <p className="text-xs text-gray-500">AI-powered deal analysis</p>
              )}
            </div>

            {/* Actions */}
            {selectedDealId && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportChat}
                  disabled={messages.length === 0}
                  title="Export chat"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewScorecard}
                  title="View scorecard"
                >
                  <BarChart2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearChat}
                  disabled={messages.length === 0}
                  title="Clear chat"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {!selectedDealId ? (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center p-8">
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-8 w-8 text-gray-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Select a deal to start chatting
              </h2>
              <p className="text-gray-500 max-w-sm">
                Use the dropdown above to select a deal and ask questions about financials, risk analysis, and recommendations.
              </p>
            </div>
          </div>
        ) : (
          <>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center max-w-md">
                    <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="font-medium text-gray-900 mb-2">
                      Start a conversation
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Ask questions about this deal&apos;s financial health, risk factors, or get recommendations.
                    </p>
                    <SuggestedQuestions
                      context={dealContext}
                      onQuestionClick={handleSuggestedQuestion}
                      className="justify-center"
                    />
                  </div>
                </div>
              ) : (
                <>
                  {messages.map(message => (
                    <ChatMessage key={message.id} message={message} />
                  ))}
                  {isStreaming && messages[messages.length - 1]?.content === '' && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 rounded-2xl px-4 py-3">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggested Questions (when there are messages) */}
            {messages.length > 0 && (
              <div className="px-4 pb-2">
                <SuggestedQuestions
                  context={dealContext}
                  onQuestionClick={handleSuggestedQuestion}
                />
              </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t bg-white">
              <div className="flex gap-3">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about this deal..."
                  disabled={isStreaming}
                  rows={1}
                  className={cn(
                    'flex-1 resize-none rounded-xl border px-4 py-3 text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'min-h-[48px] max-h-32'
                  )}
                  style={{ height: 'auto' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = 'auto'
                    target.style.height = Math.min(target.scrollHeight, 128) + 'px'
                  }}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  size="lg"
                  className="h-12 w-12 rounded-xl shrink-0"
                >
                  {isStreaming ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Context Panel - Right Sidebar (only when deal is selected) */}
      {selectedDealId && (
        <DealContextPanel
          context={dealContext}
          loading={loadingContext}
          collapsed={contextPanelCollapsed}
          onToggle={() => setContextPanelCollapsed(!contextPanelCollapsed)}
          onAskQuestion={handleSuggestedQuestion}
        />
      )}
    </div>
  )
}
