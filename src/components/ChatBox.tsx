import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Send, Bot, User, Loader2, ShieldAlert, CheckCircle2, AlertTriangle, XCircle, GitBranch } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  assessment?: any;
  resolved?: boolean;
}

export default function ChatBox() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'agent',
      content: 'Hello. I am The Sentinel. I manage your code changes with strict accountability. What task would you like me to perform?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [pendingConsent, setPendingConsent] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim() || pendingConsent) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate agent response based on input
    setTimeout(() => {
      const isCommand = input.toLowerCase().includes('run') || input.toLowerCase().includes('execute') || input.toLowerCase().includes('install') || input.toLowerCase().includes('drop');
      
      let agentMessage: Message;

      if (isCommand) {
        // Simulate the Security Assessor MCP response
        const isCritical = input.toLowerCase().includes('drop') || input.toLowerCase().includes('rm');
        const mockAssessment = {
          target_system: isCritical ? 'Database (SQLite/SQL)' : 'Shell/OS',
          execution_plan: [
            `Analyze command: ${input}`,
            isCritical ? 'WARNING: This command will permanently delete data.' : 'Recommendation: Append `--dry-run` to see dependency resolution without installing.'
          ],
          rollback_available: !isCritical,
          risk_level: isCritical ? 'Critical' : 'Medium',
          justification: isCritical ? 'Destructive operation detected. Data loss is permanent.' : 'Dependency installation or system package modification.',
          environment: 'production'
        };

        agentMessage = {
          id: (Date.now() + 1).toString(),
          role: 'agent',
          content: `I have intercepted your request to execute a command on the production environment. I ran it through the **Security Assessor MCP** for a dry run and risk analysis. Please review the impact below before proceeding.`,
          timestamp: new Date(),
          assessment: mockAssessment,
          resolved: false
        };
        setPendingConsent(true);
      } else {
        const safeName = input.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').toLowerCase().slice(0, 15);
        const hash = Math.random().toString(16).slice(2, 8);
        const branchName = `sentinel/task-${safeName}-${hash}`;
        
        agentMessage = {
          id: (Date.now() + 1).toString(),
          role: 'agent',
          content: `I have received your request to: "${userMessage.content}".\n\nTo maintain strict accountability, I have created a new isolated branch for this task:\n\`${branchName}\`\n\nI will now isolate the necessary changes and generate atomic commits using the STAR methodology on this branch.`,
          timestamp: new Date()
        };
      }

      setMessages(prev => [...prev, agentMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const handleConsentAction = (messageId: string, action: 'approve' | 'reject') => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, resolved: true } : msg
    ));
    setPendingConsent(false);

    const systemMessage: Message = {
      id: Date.now().toString(),
      role: 'system',
      content: action === 'approve' 
        ? 'Action Approved: Executing command on target environment...'
        : 'Action Rejected: Command execution aborted and reverted.',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, systemMessage]);
  };

  const renderAssessment = (msg: Message) => {
    const assessment = msg.assessment;
    if (!assessment) return null;

    const getRiskColor = (level: string) => {
      switch (level.toLowerCase()) {
        case 'critical': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
        case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
        case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
        case 'low': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
        default: return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
      }
    };

    return (
      <div className={`mt-3 bg-[#111111] border rounded-xl overflow-hidden transition-colors ${msg.resolved ? 'border-white/10 opacity-75' : 'border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.1)]'}`}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-black/20">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
            <ShieldAlert size={14} className={msg.resolved ? 'text-gray-500' : 'text-orange-400'} />
            Security Assessment
          </div>
          <div className={`px-2 py-0.5 rounded-md text-xs font-bold border ${getRiskColor(assessment.risk_level)}`}>
            {assessment.risk_level.toUpperCase()} RISK
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Target System</div>
              <div className="text-sm text-gray-300 font-mono">{assessment.target_system}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Environment</div>
              <div className="text-sm text-orange-400 font-mono">{assessment.environment}</div>
            </div>
          </div>
          
          <div>
            <div className="text-xs text-gray-500 mb-1">Justification</div>
            <div className="text-sm text-gray-300">{assessment.justification}</div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Execution Plan (Dry Run)</div>
            <div className="bg-black/40 rounded-lg p-3 border border-white/5 font-mono text-xs text-gray-400 space-y-1">
              {assessment.execution_plan.map((step: string, i: number) => (
                <div key={i} className={step.includes('WARNING') ? 'text-rose-400' : ''}>
                  {step}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-white/5">
            {assessment.rollback_available ? (
              <div className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle2 size={14} />
                Rollback Available
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-rose-400">
                <AlertTriangle size={14} />
                No Easy Rollback
              </div>
            )}
          </div>
        </div>
        
        {!msg.resolved && (
          <div className="px-4 py-3 bg-orange-500/5 border-t border-orange-500/20 flex gap-3">
            <button 
              onClick={() => handleConsentAction(msg.id, 'reject')}
              className="flex-1 py-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg text-sm font-medium hover:bg-rose-500/20 transition-colors flex items-center justify-center gap-2"
            >
              <XCircle size={16} />
              Reject & Revert
            </button>
            <button 
              onClick={() => handleConsentAction(msg.id, 'approve')}
              className="flex-1 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-sm font-medium hover:bg-emerald-500/20 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} />
              Approve & Execute
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} ${msg.role === 'system' ? 'justify-center' : ''}`}
          >
            {msg.role !== 'system' && (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'user' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
            )}
            
            {msg.role === 'system' ? (
              <div className={`px-4 py-2 rounded-full text-xs font-medium border ${
                msg.content.includes('Approved') 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                {msg.content}
              </div>
            ) : (
              <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className="text-xs text-gray-500 mb-1">
                  {msg.role === 'user' ? 'You' : 'The Sentinel'} • {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className={`p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user' 
                    ? 'bg-blue-500/10 text-blue-100 border border-blue-500/20 rounded-tr-sm' 
                    : 'bg-white/5 text-gray-300 border border-white/10 rounded-tl-sm'
                }`}>
                  {msg.content.split('`').map((part, i) => {
                    if (i % 2 === 1) {
                      return (
                        <span key={i} className="inline-flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded border border-white/10 font-mono text-emerald-400 mx-1">
                          <GitBranch size={12} />
                          {part}
                        </span>
                      );
                    }
                    return part;
                  })}
                </div>
                {msg.assessment && renderAssessment(msg)}
              </div>
            )}
          </motion.div>
        ))}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 flex-row"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Bot size={16} />
            </div>
            <div className="bg-white/5 border border-white/10 p-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-emerald-400" />
              <span className="text-sm text-gray-400">Processing request...</span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/10 bg-[#111111] relative">
        {pendingConsent && (
          <div className="absolute inset-0 bg-[#111111]/80 backdrop-blur-sm z-10 flex items-center justify-center border-t border-orange-500/30">
            <div className="flex items-center gap-2 text-orange-400 font-medium text-sm bg-orange-500/10 px-4 py-2 rounded-full border border-orange-500/20 shadow-lg">
              <AlertTriangle size={16} />
              Pending Consent: Review the assessment above to continue.
            </div>
          </div>
        )}
        <div className="relative flex items-center">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={pendingConsent || isTyping}
            placeholder={pendingConsent ? "Awaiting your approval..." : "Describe the task or command for The Sentinel..."}
            className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 resize-none h-[52px] overflow-hidden disabled:opacity-50"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping || pendingConsent}
            className="absolute right-2 p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 disabled:opacity-50 disabled:hover:bg-emerald-500/20 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="text-center mt-2">
          <span className="text-[10px] text-gray-600 uppercase tracking-wider">
            Protected by Sentinel Security Assessor
          </span>
        </div>
      </div>
    </div>
  );
}
