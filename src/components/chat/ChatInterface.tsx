'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Loader2, Bot, User, MessageSquare, Download } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatInterfaceProps {
  dealId: string
  dealName: string
  className?: string
}

export function ChatInterface({ dealId, dealName, className }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Load chat history on mount
  useEffect(() => {
    loadChatHistory()
  }, [dealId])

  async function loadChatHistory() {
    try {
      const response = await fetch(`/api/deals/${dealId}/chat/history`)
      if (response.ok) {
        const history = await response.json()
        setMessages(history.map((m: Message) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        })))
      }
    } catch (error) {
      console.error('Failed to load chat history:', error)
    }
  }

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Create placeholder for assistant response
    const assistantMessageId = crypto.randomUUID()
    const assistantMessage: Message = {
      id: assistantMessageId,
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
          dealId,
          message: userMessage.content,
          conversationHistory: messages
        })
      })

      if (!response.ok) {
        throw new Error('Chat request failed')
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No response body')

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
              // Not JSON, skip
            }
          }
        }
      }

      // Save messages to history
      await saveChatMessages([userMessage, { ...assistantMessage, content: fullContent }])

    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => {
        const updated = [...prev]
        const lastIndex = updated.length - 1
        if (updated[lastIndex]?.role === 'assistant') {
          updated[lastIndex] = {
            ...updated[lastIndex],
            content: 'Sorry, I encountered an error. Please try again.'
          }
        }
        return updated
      })
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }, [input, isLoading, dealId, messages])

  async function saveChatMessages(newMessages: Message[]) {
    try {
      await fetch(`/api/deals/${dealId}/chat/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages })
      })
    } catch (error) {
      console.error('Failed to save chat history:', error)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleSuggestedQuestion(question: string) {
    setInput(question)
    inputRef.current?.focus()
  }

  function exportChat() {
    const content = `# Chat Analysis: ${dealName}

Generated: ${new Date().toLocaleString()}
Deal ID: ${dealId}

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
    a.download = `${dealName.replace(/\s+/g, '_')}_chat_${new Date().toISOString().split('T')[0]}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card className={`flex flex-col h-[600px] ${className || ''}`}>
      <CardHeader className="border-b py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Deal Analyst
          </CardTitle>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={exportChat}>
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages Area */}
        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-6">
              <Bot className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Ask me about this deal</p>
              <p className="text-xs mt-1 mb-4">
                I have access to all transaction data and analytics.
              </p>
              <div className="space-y-2 text-left">
                <SuggestedQuestion
                  onClick={handleSuggestedQuestion}
                  question="Summarize this deal in 3 sentences"
                />
                <SuggestedQuestion
                  onClick={handleSuggestedQuestion}
                  question="What are the main red flags?"
                />
                <SuggestedQuestion
                  onClick={handleSuggestedQuestion}
                  question="Show me the MCA payment history"
                />
                <SuggestedQuestion
                  onClick={handleSuggestedQuestion}
                  question="Should I approve this deal?"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isLoading && messages[messages.length - 1]?.content === '' && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analyzing...</span>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t p-3">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this deal..."
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}

      <div className={`max-w-[85%] rounded-lg px-3 py-2 ${
        isUser
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted'
      }`}>
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content || (
            <span className="text-muted-foreground italic">Thinking...</span>
          )}
        </div>
        <div className={`text-[10px] mt-1 ${
          isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'
        }`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {isUser && (
        <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </div>
  )
}

function SuggestedQuestion({ question, onClick }: { question: string; onClick: (q: string) => void }) {
  return (
    <button
      onClick={() => onClick(question)}
      className="block w-full text-left px-3 py-2 rounded-md border hover:bg-muted transition-colors text-xs"
    >
      {question}
    </button>
  )
}
