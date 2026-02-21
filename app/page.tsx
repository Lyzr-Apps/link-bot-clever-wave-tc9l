'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  FiSettings,
  FiSearch,
  FiSend,
  FiBarChart2,
  FiPlus,
  FiTrash2,
  FiEye,
  FiChevronDown,
  FiChevronUp,
  FiUsers,
  FiTarget,
  FiCheckCircle,
  FiClock,
  FiTrendingUp,
  FiAlertCircle,
  FiPause,
  FiPlay,
  FiLinkedin
} from 'react-icons/fi'

// -- Agent IDs --
const AGENT_ICP_DISCOVERY = '6998f4431e2ec8b5186f7c5f'
const AGENT_OUTREACH = '6998f4431e2ec8b5186f7c61'
const AGENT_ENGAGEMENT = '6998f444eede22c580c0159c'

// -- Types --
interface Prospect {
  name: string
  title: string
  company: string
  industry: string
  company_size: string
  location: string
  relevance_score: number
  profile_summary: string
  linkedin_url: string
  suggested_segment: string
  personalization_rationale: string
}

interface FollowUpMessage {
  sequence_number: number
  message: string
  delay_days: number
}

interface OutreachResult {
  prospect_name: string
  segment: string
  connection_note: string
  follow_up_messages: FollowUpMessage[]
  status: string
  personalization_notes: string
}

interface CampaignSummary {
  total_outreach: number
  requests_queued: number
  estimated_completion: string
}

interface Metrics {
  acceptance_rate: number
  response_rate: number
  avg_response_time_hours: number
  best_performing_segment: string
  total_sent: number
  total_accepted: number
  total_replied: number
}

interface SegmentBreakdown {
  segment_name: string
  sent: number
  accepted: number
  replied: number
  conversion_rate: number
}

interface Recommendation {
  recommendation: string
  impact: string
  priority: string
}

interface Segment {
  id: string
  name: string
  criteria: string
  connectionNote: string
  followUp1: string
  followUp2: string
  followUp3: string
}

type ScreenType = 'configuration' | 'discovery' | 'outreach' | 'analytics'

// -- Robust response parser --
function parseAgentResponse(result: any) {
  if (!result?.success) return null
  let data = result?.response?.result
  if (typeof data === 'string') {
    try { data = JSON.parse(data) } catch { return null }
  }
  return data
}

// -- Markdown renderer --
function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">{part}</strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  )
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

// -- Sample data --
const SAMPLE_PROSPECTS: Prospect[] = [
  { name: 'Sarah Chen', title: 'VP of Engineering', company: 'DataScale Inc', industry: 'Technology', company_size: '201-500', location: 'San Francisco, CA', relevance_score: 95, profile_summary: 'Experienced engineering leader with 15 years in AI/ML infrastructure. Led team growth from 20 to 120 engineers.', linkedin_url: 'https://linkedin.com/in/sarahchen', suggested_segment: 'Enterprise Tech', personalization_rationale: 'Strong alignment with AI-powered solutions. Company recently raised Series C.' },
  { name: 'Michael Torres', title: 'Director of Sales', company: 'GrowthMetrics', industry: 'SaaS', company_size: '51-200', location: 'Austin, TX', relevance_score: 88, profile_summary: 'Sales leader focused on B2B SaaS growth. Specializes in building outbound sales teams and pipeline optimization.', linkedin_url: 'https://linkedin.com/in/michaeltorres', suggested_segment: 'Mid-Market SaaS', personalization_rationale: 'Active content creator on LinkedIn. Published about outreach automation last week.' },
  { name: 'Priya Patel', title: 'Head of Marketing', company: 'BrandForge', industry: 'Marketing', company_size: '11-50', location: 'New York, NY', relevance_score: 82, profile_summary: 'Digital marketing strategist specializing in B2B demand generation and brand positioning.', linkedin_url: 'https://linkedin.com/in/priyapatel', suggested_segment: 'Startup Marketing', personalization_rationale: 'Company is expanding into enterprise segment. Likely needs prospecting tools.' },
  { name: 'James O\'Brien', title: 'CTO', company: 'FinEdge Solutions', industry: 'FinTech', company_size: '501-1000', location: 'Chicago, IL', relevance_score: 91, profile_summary: 'Technology executive with deep expertise in financial data platforms and compliance automation.', linkedin_url: 'https://linkedin.com/in/jamesobrien', suggested_segment: 'Enterprise Tech', personalization_rationale: 'Currently evaluating AI tools for their sales team. Posted job listing for Sales Ops.' },
  { name: 'Lena Kim', title: 'Founder & CEO', company: 'NexusAI', industry: 'Artificial Intelligence', company_size: '1-10', location: 'Seattle, WA', relevance_score: 78, profile_summary: 'Serial entrepreneur building her third startup. Previously co-founded two SaaS companies with successful exits.', linkedin_url: 'https://linkedin.com/in/lenakim', suggested_segment: 'Startup Marketing', personalization_rationale: 'Early-stage but well-connected. Could be a strategic partnership opportunity.' },
]

const SAMPLE_OUTREACH: OutreachResult[] = [
  { prospect_name: 'Sarah Chen', segment: 'Enterprise Tech', connection_note: 'Hi Sarah, I noticed your work scaling DataScale\'s engineering team is impressive. We help leaders like you automate prospect identification using AI. Would love to connect.', follow_up_messages: [{ sequence_number: 1, message: 'Hi Sarah, thanks for connecting! I saw your recent talk on engineering culture. We\'ve helped similar teams save 10hrs/week on prospecting. Worth a quick chat?', delay_days: 3 }, { sequence_number: 2, message: 'Sarah, quick follow-up. We just published a case study with a Series C company similar to DataScale. Happy to share if useful.', delay_days: 3 }], status: 'Connected', personalization_notes: 'Reference Series C raise and team scaling.' },
  { prospect_name: 'Michael Torres', segment: 'Mid-Market SaaS', connection_note: 'Michael, your insights on outbound sales are spot on. We built something that aligns with your pipeline philosophy. Let\'s connect?', follow_up_messages: [{ sequence_number: 1, message: 'Thanks for connecting, Michael! Your post on pipeline optimization resonated. Our tool automates the prospect discovery part. Interested in seeing a demo?', delay_days: 3 }], status: 'Request Sent', personalization_notes: 'Reference his LinkedIn content on pipeline optimization.' },
  { prospect_name: 'James O\'Brien', segment: 'Enterprise Tech', connection_note: 'James, FinEdge\'s approach to compliance automation is fascinating. We help fintech leaders find the right prospects at scale. Would love to exchange ideas.', follow_up_messages: [{ sequence_number: 1, message: 'Hi James, appreciate the connection! I noticed you\'re building out the sales ops function. Our AI prospecting tool integrates seamlessly with existing CRMs. Worth exploring?', delay_days: 3 }], status: 'Pending', personalization_notes: 'Reference Sales Ops job posting and compliance focus.' },
]

const SAMPLE_ANALYTICS: { metrics: Metrics; segment_breakdown: SegmentBreakdown[]; recommendations: Recommendation[] } = {
  metrics: { acceptance_rate: 42, response_rate: 28, avg_response_time_hours: 18.5, best_performing_segment: 'Enterprise Tech', total_sent: 150, total_accepted: 63, total_replied: 42 },
  segment_breakdown: [
    { segment_name: 'Enterprise Tech', sent: 75, accepted: 38, replied: 25, conversion_rate: 33.3 },
    { segment_name: 'Mid-Market SaaS', sent: 50, accepted: 18, replied: 12, conversion_rate: 24.0 },
    { segment_name: 'Startup Marketing', sent: 25, accepted: 7, replied: 5, conversion_rate: 20.0 },
  ],
  recommendations: [
    { recommendation: 'Increase outreach to Enterprise Tech segment. This segment has 33% conversion rate, significantly above average.', impact: 'High', priority: 'High' },
    { recommendation: 'Revise connection note for Startup Marketing segment. Current template underperforms by 40% compared to Enterprise Tech.', impact: 'Medium', priority: 'Medium' },
    { recommendation: 'Shift active hours to 8am-10am window. Data shows 2x higher acceptance rate during morning hours.', impact: 'High', priority: 'High' },
    { recommendation: 'Add a third follow-up message for Mid-Market SaaS. Most replies come after the second touchpoint.', impact: 'Medium', priority: 'Low' },
  ],
}

// -- ErrorBoundary --
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Try again</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// -- Sidebar Navigation --
function SidebarNav({ activeScreen, onNavigate, activeAgentId }: { activeScreen: ScreenType; onNavigate: (s: ScreenType) => void; activeAgentId: string | null }) {
  const items: { key: ScreenType; label: string; icon: React.ReactNode; agentId: string | null }[] = [
    { key: 'configuration', label: 'Configuration', icon: <FiSettings className="w-5 h-5" />, agentId: null },
    { key: 'discovery', label: 'Discovery', icon: <FiSearch className="w-5 h-5" />, agentId: AGENT_ICP_DISCOVERY },
    { key: 'outreach', label: 'Outreach', icon: <FiSend className="w-5 h-5" />, agentId: AGENT_OUTREACH },
    { key: 'analytics', label: 'Analytics', icon: <FiBarChart2 className="w-5 h-5" />, agentId: AGENT_ENGAGEMENT },
  ]

  return (
    <aside className="w-64 min-h-screen flex flex-col border-r border-border bg-white/60 backdrop-blur-[16px]">
      <div className="p-5 flex items-center gap-3 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
          <FiLinkedin className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground leading-tight">LinkedIn ICP</h1>
          <p className="text-xs text-muted-foreground">Outreach Automation</p>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${activeScreen === item.key ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
          >
            {item.icon}
            <span>{item.label}</span>
            {activeAgentId && item.agentId === activeAgentId && (
              <span className="ml-auto w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            )}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground mb-2 font-medium">Agent Status</div>
        <div className="space-y-1.5">
          {[
            { id: AGENT_ICP_DISCOVERY, name: 'ICP Discovery', desc: 'Perplexity / sonar-pro' },
            { id: AGENT_OUTREACH, name: 'Outreach', desc: 'OpenAI / gpt-4.1' },
            { id: AGENT_ENGAGEMENT, name: 'Engagement', desc: 'OpenAI / gpt-4.1' },
          ].map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-xs">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activeAgentId === a.id ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
              <span className="text-foreground font-medium truncate">{a.name}</span>
              <span className="text-muted-foreground truncate ml-auto">{a.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

// -- Configuration Screen --
function ConfigurationScreen({
  icpConfig,
  setIcpConfig,
  segments,
  setSegments,
  scheduleConfig,
  setScheduleConfig,
  configSaved,
  onSave,
}: {
  icpConfig: { titles: string; industries: string; companySize: string; location: string; keywords: string }
  setIcpConfig: React.Dispatch<React.SetStateAction<typeof icpConfig>>
  segments: Segment[]
  setSegments: React.Dispatch<React.SetStateAction<Segment[]>>
  scheduleConfig: { dailyLimit: number; followUpDelay: number; activeHoursStart: string; activeHoursEnd: string }
  setScheduleConfig: React.Dispatch<React.SetStateAction<typeof scheduleConfig>>
  configSaved: boolean
  onSave: () => void
}) {
  const addSegment = () => {
    setSegments((prev) => [...prev, { id: Date.now().toString(), name: '', criteria: '', connectionNote: '', followUp1: '', followUp2: '', followUp3: '' }])
  }
  const removeSegment = (id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id))
  }
  const updateSegment = (id: string, field: keyof Segment, value: string) => {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  const hours = Array.from({ length: 24 }, (_, i) => {
    const h = i % 12 === 0 ? 12 : i % 12
    const ampm = i < 12 ? 'AM' : 'PM'
    return { value: `${i}`, label: `${h}:00 ${ampm}` }
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Configuration</h2>
        <p className="text-sm text-muted-foreground mt-1">Define your ideal customer profile, messaging segments, and scheduling rules.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - ICP Criteria */}
        <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-xl shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2"><FiTarget className="w-4 h-4" /> ICP Criteria</CardTitle>
            <CardDescription>Define who you want to target on LinkedIn.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="titles" className="text-sm font-medium">Job Titles</Label>
              <Textarea id="titles" placeholder="VP of Sales, Director of Marketing, CTO (comma separated)" value={icpConfig.titles} onChange={(e) => setIcpConfig((prev) => ({ ...prev, titles: e.target.value }))} rows={3} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="industries" className="text-sm font-medium">Industries</Label>
              <Textarea id="industries" placeholder="SaaS, FinTech, Healthcare (comma separated)" value={icpConfig.industries} onChange={(e) => setIcpConfig((prev) => ({ ...prev, industries: e.target.value }))} rows={3} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="companySize" className="text-sm font-medium">Company Size</Label>
              <Select value={icpConfig.companySize} onValueChange={(v) => setIcpConfig((prev) => ({ ...prev, companySize: v }))}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select company size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-10">1-10 employees</SelectItem>
                  <SelectItem value="11-50">11-50 employees</SelectItem>
                  <SelectItem value="51-200">51-200 employees</SelectItem>
                  <SelectItem value="201-500">201-500 employees</SelectItem>
                  <SelectItem value="501-1000">501-1000 employees</SelectItem>
                  <SelectItem value="1001-5000">1001-5000 employees</SelectItem>
                  <SelectItem value="5000+">5000+ employees</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="location" className="text-sm font-medium">Geography / Location</Label>
              <Input id="location" placeholder="e.g. San Francisco, United States" value={icpConfig.location} onChange={(e) => setIcpConfig((prev) => ({ ...prev, location: e.target.value }))} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="keywords" className="text-sm font-medium">Keywords</Label>
              <Textarea id="keywords" placeholder="AI, automation, B2B, growth" value={icpConfig.keywords} onChange={(e) => setIcpConfig((prev) => ({ ...prev, keywords: e.target.value }))} rows={2} className="mt-1.5" />
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Segments, Templates, Scheduling */}
        <div className="space-y-6">
          {/* Segment Manager */}
          <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-xl shadow-md">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2"><FiUsers className="w-4 h-4" /> Segments & Templates</CardTitle>
                  <CardDescription>Group prospects and set messaging templates.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={addSegment} className="gap-1">
                  <FiPlus className="w-3.5 h-3.5" /> Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {segments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No segments created yet. Click "Add" to create one.</p>
              )}
              <ScrollArea className={segments.length > 1 ? 'h-[420px]' : ''}>
                <div className="space-y-4 pr-2">
                  {segments.map((seg) => (
                    <SegmentCard key={seg.id} segment={seg} onUpdate={updateSegment} onRemove={removeSegment} />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Scheduling Controls */}
          <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-xl shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2"><FiClock className="w-4 h-4" /> Scheduling</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Daily Send Limit</Label>
                  <span className="text-sm font-semibold text-foreground">{scheduleConfig.dailyLimit}</span>
                </div>
                <Slider value={[scheduleConfig.dailyLimit]} onValueChange={(v) => setScheduleConfig((prev) => ({ ...prev, dailyLimit: v[0] }))} min={1} max={100} step={1} />
              </div>
              <div>
                <Label className="text-sm font-medium">Follow-up Delay</Label>
                <Select value={String(scheduleConfig.followUpDelay)} onValueChange={(v) => setScheduleConfig((prev) => ({ ...prev, followUpDelay: parseInt(v) }))}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <SelectItem key={d} value={String(d)}>{d} {d === 1 ? 'day' : 'days'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Active From</Label>
                  <Select value={scheduleConfig.activeHoursStart} onValueChange={(v) => setScheduleConfig((prev) => ({ ...prev, activeHoursStart: v }))}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {hours.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Active Until</Label>
                  <Select value={scheduleConfig.activeHoursEnd} onValueChange={(v) => setScheduleConfig((prev) => ({ ...prev, activeHoursEnd: v }))}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {hours.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={onSave} className="gap-2 px-6">
          <FiCheckCircle className="w-4 h-4" /> Save Configuration
        </Button>
        {configSaved && (
          <span className="text-sm text-green-600 font-medium flex items-center gap-1.5">
            <FiCheckCircle className="w-4 h-4" /> Configuration saved successfully
          </span>
        )}
      </div>
    </div>
  )
}

// -- Segment Card Sub-Component --
function SegmentCard({ segment, onUpdate, onRemove }: { segment: Segment; onUpdate: (id: string, field: keyof Segment, value: string) => void; onRemove: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const charCount = (segment.connectionNote ?? '').length

  return (
    <div className="border border-border rounded-xl p-4 bg-white/50 space-y-3">
      <div className="flex items-center gap-2">
        <Input placeholder="Segment name" value={segment.name} onChange={(e) => onUpdate(segment.id, 'name', e.target.value)} className="flex-1 text-sm font-medium" />
        <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="px-2">
          {expanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onRemove(segment.id)} className="px-2 text-destructive hover:text-destructive">
          <FiTrash2 className="w-4 h-4" />
        </Button>
      </div>
      <Textarea placeholder="Criteria description" value={segment.criteria} onChange={(e) => onUpdate(segment.id, 'criteria', e.target.value)} rows={2} className="text-sm" />

      {expanded && (
        <div className="space-y-3 pt-2">
          <Separator />
          <p className="text-xs text-muted-foreground">Merge tags: {'{first_name}'}, {'{company}'}, {'{title}'}</p>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs font-medium">Connection Request Note</Label>
              <span className={`text-xs ${charCount > 300 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>{charCount}/300</span>
            </div>
            <Textarea placeholder="Hi {first_name}, I noticed..." value={segment.connectionNote} onChange={(e) => { if (e.target.value.length <= 300) onUpdate(segment.id, 'connectionNote', e.target.value) }} rows={3} className="text-sm" />
          </div>
          <div>
            <Label className="text-xs font-medium">Follow-up 1</Label>
            <Textarea placeholder="Follow-up message 1..." value={segment.followUp1} onChange={(e) => onUpdate(segment.id, 'followUp1', e.target.value)} rows={2} className="text-sm mt-1" />
          </div>
          <div>
            <Label className="text-xs font-medium">Follow-up 2</Label>
            <Textarea placeholder="Follow-up message 2..." value={segment.followUp2} onChange={(e) => onUpdate(segment.id, 'followUp2', e.target.value)} rows={2} className="text-sm mt-1" />
          </div>
          <div>
            <Label className="text-xs font-medium">Follow-up 3</Label>
            <Textarea placeholder="Follow-up message 3..." value={segment.followUp3} onChange={(e) => onUpdate(segment.id, 'followUp3', e.target.value)} rows={2} className="text-sm mt-1" />
          </div>
        </div>
      )}
    </div>
  )
}

// -- Discovery Screen --
function DiscoveryScreen({
  icpConfig,
  prospects,
  setProspects,
  selectedProspects,
  setSelectedProspects,
  loading,
  setLoading,
  activeAgentId,
  setActiveAgentId,
  sampleDataOn,
}: {
  icpConfig: { titles: string; industries: string; companySize: string; location: string; keywords: string }
  prospects: Prospect[]
  setProspects: React.Dispatch<React.SetStateAction<Prospect[]>>
  selectedProspects: Set<number>
  setSelectedProspects: React.Dispatch<React.SetStateAction<Set<number>>>
  loading: Record<string, boolean>
  setLoading: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  activeAgentId: string | null
  setActiveAgentId: React.Dispatch<React.SetStateAction<string | null>>
  sampleDataOn: boolean
}) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchSummary, setSearchSummary] = useState<string>('')
  const [totalFound, setTotalFound] = useState<number>(0)

  const displayProspects = sampleDataOn && prospects.length === 0 ? SAMPLE_PROSPECTS : prospects

  const handleDiscover = async () => {
    setError(null)
    setLoading((prev) => ({ ...prev, discovery: true }))
    setActiveAgentId(AGENT_ICP_DISCOVERY)

    const message = `Find LinkedIn prospects matching these ICP criteria: Job Titles: [${icpConfig.titles || 'Any'}], Industries: [${icpConfig.industries || 'Any'}], Company Size: [${icpConfig.companySize || 'Any'}], Location: [${icpConfig.location || 'Any'}], Keywords: [${icpConfig.keywords || 'Any'}]. Return ranked prospect list with relevance scores.`

    try {
      const result = await callAIAgent(message, AGENT_ICP_DISCOVERY)
      const data = parseAgentResponse(result)

      if (data) {
        const prospectList = Array.isArray(data?.prospects) ? data.prospects : []
        setProspects(prospectList.map((p: any) => ({
          name: p?.name ?? 'Unknown',
          title: p?.title ?? '',
          company: p?.company ?? '',
          industry: p?.industry ?? '',
          company_size: p?.company_size ?? '',
          location: p?.location ?? '',
          relevance_score: typeof p?.relevance_score === 'number' ? p.relevance_score : 0,
          profile_summary: p?.profile_summary ?? '',
          linkedin_url: p?.linkedin_url ?? '',
          suggested_segment: p?.suggested_segment ?? '',
          personalization_rationale: p?.personalization_rationale ?? '',
        })))
        setSearchSummary(data?.search_criteria_summary ?? '')
        setTotalFound(typeof data?.total_found === 'number' ? data.total_found : prospectList.length)
        setSelectedProspects(new Set())
      } else {
        setError(result?.error ?? 'Failed to parse discovery results. Please try again.')
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading((prev) => ({ ...prev, discovery: false }))
      setActiveAgentId(null)
    }
  }

  const toggleSelect = (idx: number) => {
    setSelectedProspects((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedProspects.size === displayProspects.length) {
      setSelectedProspects(new Set())
    } else {
      setSelectedProspects(new Set(displayProspects.map((_, i) => i)))
    }
  }

  const removeSelected = () => {
    setProspects((prev) => prev.filter((_, i) => !selectedProspects.has(i)))
    setSelectedProspects(new Set())
  }

  const isLoading = loading?.discovery ?? false

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Discovery</h2>
          <p className="text-sm text-muted-foreground mt-1">Find and review prospects matching your ICP criteria.</p>
        </div>
        <Button onClick={handleDiscover} disabled={isLoading} className="gap-2">
          {isLoading ? (
            <><span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Discovering...</>
          ) : (
            <><FiSearch className="w-4 h-4" /> Discover Prospects</>
          )}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={handleDiscover} className="ml-auto text-red-700 hover:text-red-800">Retry</Button>
        </div>
      )}

      {searchSummary && (
        <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-xl shadow-md">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{searchSummary}</p>
            <Badge variant="secondary">{totalFound} found</Badge>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-xl shadow-md">
          <CardContent className="py-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : displayProspects.length === 0 ? (
        <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-xl shadow-md">
          <CardContent className="py-16 text-center">
            <FiSearch className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No prospects discovered yet. Configure your ICP criteria and click Discover Prospects.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {selectedProspects.size > 0 && (
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-xs">{selectedProspects.size} selected</Badge>
              <Button variant="outline" size="sm" onClick={removeSelected} className="gap-1 text-destructive hover:text-destructive">
                <FiTrash2 className="w-3.5 h-3.5" /> Remove Selected
              </Button>
            </div>
          )}

          <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-xl shadow-md overflow-hidden">
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={selectedProspects.size === displayProspects.length && displayProspects.length > 0} onCheckedChange={toggleSelectAll} />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead>Segment</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayProspects.map((prospect, idx) => (
                    <React.Fragment key={idx}>
                      <TableRow className="cursor-pointer hover:bg-accent/50" onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selectedProspects.has(idx)} onCheckedChange={() => toggleSelect(idx)} />
                        </TableCell>
                        <TableCell className="font-medium text-sm">{prospect.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{prospect.title}</TableCell>
                        <TableCell className="text-sm">{prospect.company}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{prospect.industry}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 justify-center">
                            <Progress value={prospect.relevance_score} className="w-16 h-2" />
                            <span className="text-xs font-medium w-8">{prospect.relevance_score}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{prospect.suggested_segment || 'Unassigned'}</Badge>
                        </TableCell>
                        <TableCell>
                          {expandedRow === idx ? <FiChevronUp className="w-4 h-4 text-muted-foreground" /> : <FiChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </TableCell>
                      </TableRow>
                      {expandedRow === idx && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-accent/30 p-4">
                            <div className="space-y-3">
                              <div>
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Profile Summary</span>
                                <p className="text-sm mt-1">{prospect.profile_summary || 'No summary available.'}</p>
                              </div>
                              <div>
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Personalization Rationale</span>
                                <p className="text-sm mt-1">{prospect.personalization_rationale || 'No rationale provided.'}</p>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Location</span>
                                <span className="text-sm">{prospect.location || 'N/A'}</span>
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide ml-4">Company Size</span>
                                <span className="text-sm">{prospect.company_size || 'N/A'}</span>
                              </div>
                              {prospect.linkedin_url && (
                                <a href={prospect.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                                  <FiLinkedin className="w-3.5 h-3.5" /> View LinkedIn Profile
                                </a>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </>
      )}
    </div>
  )
}

// -- Outreach Screen --
function OutreachScreen({
  prospects,
  selectedProspects,
  segments,
  scheduleConfig,
  outreachResults,
  setOutreachResults,
  campaignSummary,
  setCampaignSummary,
  loading,
  setLoading,
  campaignPaused,
  setCampaignPaused,
  setActiveAgentId,
  sampleDataOn,
}: {
  prospects: Prospect[]
  selectedProspects: Set<number>
  segments: Segment[]
  scheduleConfig: { dailyLimit: number; followUpDelay: number; activeHoursStart: string; activeHoursEnd: string }
  outreachResults: OutreachResult[]
  setOutreachResults: React.Dispatch<React.SetStateAction<OutreachResult[]>>
  campaignSummary: CampaignSummary | null
  setCampaignSummary: React.Dispatch<React.SetStateAction<CampaignSummary | null>>
  loading: Record<string, boolean>
  setLoading: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  campaignPaused: boolean
  setCampaignPaused: React.Dispatch<React.SetStateAction<boolean>>
  setActiveAgentId: React.Dispatch<React.SetStateAction<string | null>>
  sampleDataOn: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const [previewIdx, setPreviewIdx] = useState<number | null>(null)

  const displayOutreach = sampleDataOn && outreachResults.length === 0 ? SAMPLE_OUTREACH : outreachResults
  const displaySummary = sampleDataOn && !campaignSummary ? { total_outreach: 5, requests_queued: 3, estimated_completion: '2 days' } : campaignSummary

  const selectedList = Array.from(selectedProspects).map((i) => prospects[i]).filter(Boolean)

  const handleLaunch = async () => {
    setError(null)
    setLoading((prev) => ({ ...prev, outreach: true }))
    setActiveAgentId(AGENT_OUTREACH)

    const prospectData = selectedList.map((p) => ({
      name: p?.name,
      title: p?.title,
      company: p?.company,
      segment: p?.suggested_segment,
    }))

    const templateData = segments.map((s) => ({
      segment: s.name,
      connectionNote: s.connectionNote,
      followUps: [s.followUp1, s.followUp2, s.followUp3].filter(Boolean),
    }))

    const message = `Generate personalized outreach for these prospects: ${JSON.stringify(prospectData)}. Use these templates: ${JSON.stringify(templateData)}. Follow-up delay: ${scheduleConfig.followUpDelay} days. Daily limit: ${scheduleConfig.dailyLimit}.`

    try {
      const result = await callAIAgent(message, AGENT_OUTREACH)
      const data = parseAgentResponse(result)

      if (data) {
        const results = Array.isArray(data?.outreach_results) ? data.outreach_results : []
        setOutreachResults(results.map((r: any) => ({
          prospect_name: r?.prospect_name ?? 'Unknown',
          segment: r?.segment ?? '',
          connection_note: r?.connection_note ?? '',
          follow_up_messages: Array.isArray(r?.follow_up_messages) ? r.follow_up_messages.map((f: any) => ({ sequence_number: f?.sequence_number ?? 0, message: f?.message ?? '', delay_days: f?.delay_days ?? 0 })) : [],
          status: r?.status ?? 'Pending',
          personalization_notes: r?.personalization_notes ?? '',
        })))
        if (data?.campaign_summary) {
          setCampaignSummary({
            total_outreach: data.campaign_summary?.total_outreach ?? 0,
            requests_queued: data.campaign_summary?.requests_queued ?? 0,
            estimated_completion: data.campaign_summary?.estimated_completion ?? 'N/A',
          })
        }
      } else {
        setError(result?.error ?? 'Failed to generate outreach. Please try again.')
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading((prev) => ({ ...prev, outreach: false }))
      setActiveAgentId(null)
    }
  }

  const statusColor = (status: string) => {
    const s = (status ?? '').toLowerCase()
    if (s.includes('connected') || s.includes('replied')) return 'bg-green-100 text-green-700 border-green-200'
    if (s.includes('sent') || s.includes('follow')) return 'bg-blue-100 text-blue-700 border-blue-200'
    if (s.includes('pending')) return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    return 'bg-gray-100 text-gray-700 border-gray-200'
  }

  const isLoading = loading?.outreach ?? false
  const totalSelected = sampleDataOn ? 5 : selectedList.length
  const connectedCount = displayOutreach.filter((r) => (r.status ?? '').toLowerCase().includes('connected')).length
  const sentCount = displayOutreach.filter((r) => (r.status ?? '').toLowerCase().includes('sent') || (r.status ?? '').toLowerCase().includes('connected')).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Outreach</h2>
          <p className="text-sm text-muted-foreground mt-1">Launch and monitor your outreach campaigns.</p>
        </div>
        <div className="flex items-center gap-3">
          {displayOutreach.length > 0 && (
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">{campaignPaused ? 'Paused' : 'Active'}</Label>
              <Switch checked={!campaignPaused} onCheckedChange={(v) => setCampaignPaused(!v)} />
            </div>
          )}
          <Button onClick={handleLaunch} disabled={isLoading || (totalSelected === 0 && !sampleDataOn)} className="gap-2">
            {isLoading ? (
              <><span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Launching...</>
            ) : (
              <><FiSend className="w-4 h-4" /> Launch Outreach</>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={handleLaunch} className="ml-auto text-red-700 hover:text-red-800">Retry</Button>
        </div>
      )}

      {/* Summary Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-xl shadow-md">
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center"><FiTarget className="w-4 h-4 text-blue-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Selected</p>
                <p className="text-xl font-semibold">{totalSelected}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-xl shadow-md">
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center"><FiSend className="w-4 h-4 text-indigo-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Requests Sent</p>
                <p className="text-xl font-semibold">{displaySummary?.requests_queued ?? sentCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-xl shadow-md">
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center"><FiCheckCircle className="w-4 h-4 text-green-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Connected</p>
                <p className="text-xl font-semibold">{connectedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-xl shadow-md">
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center"><FiClock className="w-4 h-4 text-purple-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Follow-ups Queued</p>
                <p className="text-xl font-semibold">{displaySummary?.requests_queued ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Outreach Queue */}
      {isLoading ? (
        <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-xl shadow-md">
          <CardContent className="py-6 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-8" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : displayOutreach.length === 0 ? (
        <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-xl shadow-md">
          <CardContent className="py-16 text-center">
            <FiSend className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No outreach campaigns running. Discover prospects first, then launch outreach.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-xl shadow-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prospect Name</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Personalization</TableHead>
                <TableHead className="w-10 text-center">Preview</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayOutreach.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium text-sm">{item.prospect_name}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{item.segment || 'N/A'}</Badge></TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${statusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{item.personalization_notes || 'N/A'}</TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="sm" onClick={() => setPreviewIdx(idx)} className="px-2">
                      <FiEye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Preview Sheet */}
      <Sheet open={previewIdx !== null} onOpenChange={(open) => { if (!open) setPreviewIdx(null) }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Message Preview</SheetTitle>
            <SheetDescription>{previewIdx !== null ? displayOutreach[previewIdx]?.prospect_name ?? '' : ''}</SheetDescription>
          </SheetHeader>
          {previewIdx !== null && displayOutreach[previewIdx] && (
            <div className="mt-6 space-y-6">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Connection Request Note</h4>
                <div className="p-3 rounded-lg bg-accent/50 text-sm leading-relaxed">
                  {displayOutreach[previewIdx]?.connection_note || 'No connection note.'}
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Follow-up Messages</h4>
                {Array.isArray(displayOutreach[previewIdx]?.follow_up_messages) && displayOutreach[previewIdx].follow_up_messages.length > 0 ? (
                  <div className="space-y-4">
                    {displayOutreach[previewIdx].follow_up_messages.map((msg, mi) => (
                      <div key={mi} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">Message {msg?.sequence_number ?? mi + 1}</Badge>
                          <span className="text-xs text-muted-foreground">After {msg?.delay_days ?? 0} {(msg?.delay_days ?? 0) === 1 ? 'day' : 'days'}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-accent/50 text-sm leading-relaxed">{msg?.message ?? ''}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No follow-up messages configured.</p>
                )}
              </div>
              <Separator />
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Personalization Notes</h4>
                <p className="text-sm text-muted-foreground">{displayOutreach[previewIdx]?.personalization_notes || 'No notes.'}</p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// -- Analytics Screen --
function AnalyticsScreen({
  analyticsData,
  setAnalyticsData,
  outreachResults,
  segments,
  loading,
  setLoading,
  setActiveAgentId,
  sampleDataOn,
}: {
  analyticsData: { metrics: Metrics; segment_breakdown: SegmentBreakdown[]; recommendations: Recommendation[] } | null
  setAnalyticsData: React.Dispatch<React.SetStateAction<typeof analyticsData>>
  outreachResults: OutreachResult[]
  segments: Segment[]
  loading: Record<string, boolean>
  setLoading: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  setActiveAgentId: React.Dispatch<React.SetStateAction<string | null>>
  sampleDataOn: boolean
}) {
  const [error, setError] = useState<string | null>(null)

  const displayData = sampleDataOn && !analyticsData ? SAMPLE_ANALYTICS : analyticsData

  const handleAnalyze = async () => {
    setError(null)
    setLoading((prev) => ({ ...prev, analytics: true }))
    setActiveAgentId(AGENT_ENGAGEMENT)

    const outreachData = outreachResults.map((r) => ({ prospect_name: r.prospect_name, segment: r.segment, status: r.status }))
    const segmentNames = segments.map((s) => s.name).filter(Boolean)

    const message = `Analyze this outreach campaign performance. Campaign data: ${JSON.stringify(outreachData)}. Segments used: ${JSON.stringify(segmentNames)}. Provide acceptance rates, response rates, segment breakdown, and optimization recommendations.`

    try {
      const result = await callAIAgent(message, AGENT_ENGAGEMENT)
      const data = parseAgentResponse(result)

      if (data) {
        const metrics: Metrics = {
          acceptance_rate: typeof data?.metrics?.acceptance_rate === 'number' ? data.metrics.acceptance_rate : 0,
          response_rate: typeof data?.metrics?.response_rate === 'number' ? data.metrics.response_rate : 0,
          avg_response_time_hours: typeof data?.metrics?.avg_response_time_hours === 'number' ? data.metrics.avg_response_time_hours : 0,
          best_performing_segment: data?.metrics?.best_performing_segment ?? 'N/A',
          total_sent: typeof data?.metrics?.total_sent === 'number' ? data.metrics.total_sent : 0,
          total_accepted: typeof data?.metrics?.total_accepted === 'number' ? data.metrics.total_accepted : 0,
          total_replied: typeof data?.metrics?.total_replied === 'number' ? data.metrics.total_replied : 0,
        }
        const segBreak = Array.isArray(data?.segment_breakdown) ? data.segment_breakdown.map((s: any) => ({
          segment_name: s?.segment_name ?? 'Unknown',
          sent: typeof s?.sent === 'number' ? s.sent : 0,
          accepted: typeof s?.accepted === 'number' ? s.accepted : 0,
          replied: typeof s?.replied === 'number' ? s.replied : 0,
          conversion_rate: typeof s?.conversion_rate === 'number' ? s.conversion_rate : 0,
        })) : []
        const recs = Array.isArray(data?.recommendations) ? data.recommendations.map((r: any) => ({
          recommendation: r?.recommendation ?? '',
          impact: r?.impact ?? 'Medium',
          priority: r?.priority ?? 'Medium',
        })) : []

        setAnalyticsData({ metrics, segment_breakdown: segBreak, recommendations: recs })
      } else {
        setError(result?.error ?? 'Failed to analyze engagement. Please try again.')
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading((prev) => ({ ...prev, analytics: false }))
      setActiveAgentId(null)
    }
  }

  const isLoading = loading?.analytics ?? false

  const impactColor = (impact: string) => {
    const v = (impact ?? '').toLowerCase()
    if (v === 'high') return 'bg-red-100 text-red-700 border-red-200'
    if (v === 'medium') return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    return 'bg-green-100 text-green-700 border-green-200'
  }

  const priorityColor = (priority: string) => {
    const v = (priority ?? '').toLowerCase()
    if (v === 'high') return 'bg-red-100 text-red-700 border-red-200'
    if (v === 'medium') return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    return 'bg-blue-100 text-blue-700 border-blue-200'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Analytics</h2>
          <p className="text-sm text-muted-foreground mt-1">Track campaign performance and get AI-powered optimization recommendations.</p>
        </div>
        <Button onClick={handleAnalyze} disabled={isLoading} className="gap-2">
          {isLoading ? (
            <><span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Analyzing...</>
          ) : (
            <><FiBarChart2 className="w-4 h-4" /> Analyze Engagement</>
          )}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={handleAnalyze} className="ml-auto text-red-700 hover:text-red-800">Retry</Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-xl shadow-md">
                <CardContent className="py-4 px-5 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-7 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-xl shadow-md">
            <CardContent className="py-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : !displayData ? (
        <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-xl shadow-md">
          <CardContent className="py-16 text-center">
            <FiBarChart2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No analytics data yet. Run a campaign and analyze engagement.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Metric Tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-xl shadow-md">
              <CardContent className="py-4 px-5">
                <p className="text-xs text-muted-foreground font-medium mb-1">Acceptance Rate</p>
                <p className="text-2xl font-semibold">{displayData.metrics?.acceptance_rate ?? 0}%</p>
                <Progress value={displayData.metrics?.acceptance_rate ?? 0} className="mt-2 h-1.5" />
                <p className="text-xs text-muted-foreground mt-1.5">{displayData.metrics?.total_accepted ?? 0} of {displayData.metrics?.total_sent ?? 0} sent</p>
              </CardContent>
            </Card>
            <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-xl shadow-md">
              <CardContent className="py-4 px-5">
                <p className="text-xs text-muted-foreground font-medium mb-1">Response Rate</p>
                <p className="text-2xl font-semibold">{displayData.metrics?.response_rate ?? 0}%</p>
                <Progress value={displayData.metrics?.response_rate ?? 0} className="mt-2 h-1.5" />
                <p className="text-xs text-muted-foreground mt-1.5">{displayData.metrics?.total_replied ?? 0} replies received</p>
              </CardContent>
            </Card>
            <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-xl shadow-md">
              <CardContent className="py-4 px-5">
                <p className="text-xs text-muted-foreground font-medium mb-1">Avg Response Time</p>
                <p className="text-2xl font-semibold">{displayData.metrics?.avg_response_time_hours ?? 0}h</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <FiClock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">hours to reply</span>
                </div>
              </CardContent>
            </Card>
            <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-xl shadow-md">
              <CardContent className="py-4 px-5">
                <p className="text-xs text-muted-foreground font-medium mb-1">Best Segment</p>
                <p className="text-lg font-semibold truncate">{displayData.metrics?.best_performing_segment ?? 'N/A'}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <FiTrendingUp className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-xs text-green-600 font-medium">Top performer</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Segment Performance Table */}
          {Array.isArray(displayData?.segment_breakdown) && displayData.segment_breakdown.length > 0 && (
            <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-xl shadow-md overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Segment Performance</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Segment</TableHead>
                      <TableHead className="text-center">Sent</TableHead>
                      <TableHead className="text-center">Accepted</TableHead>
                      <TableHead className="text-center">Replied</TableHead>
                      <TableHead className="text-center">Conversion Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayData.segment_breakdown.map((seg, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-sm">{seg?.segment_name ?? 'Unknown'}</TableCell>
                        <TableCell className="text-center text-sm">{seg?.sent ?? 0}</TableCell>
                        <TableCell className="text-center text-sm">{seg?.accepted ?? 0}</TableCell>
                        <TableCell className="text-center text-sm">{seg?.replied ?? 0}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-2 justify-center">
                            <Progress value={seg?.conversion_rate ?? 0} className="w-16 h-2" />
                            <span className="text-xs font-medium">{seg?.conversion_rate ?? 0}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* AI Recommendations */}
          {Array.isArray(displayData?.recommendations) && displayData.recommendations.length > 0 && (
            <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-xl shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><FiTrendingUp className="w-4 h-4" /> AI Recommendations</CardTitle>
                <CardDescription>Data-driven suggestions to improve campaign performance.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {displayData.recommendations.map((rec, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-border bg-white/50 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <p className="text-sm leading-relaxed">{rec?.recommendation ?? ''}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${impactColor(rec?.impact ?? '')}`}>
                            Impact: {rec?.impact ?? 'N/A'}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${priorityColor(rec?.priority ?? '')}`}>
                            {rec?.priority ?? 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// -- Main Page --
export default function Page() {
  const [activeScreen, setActiveScreen] = useState<ScreenType>('configuration')
  const [sampleDataOn, setSampleDataOn] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [linkedInConnected] = useState(true)

  // Configuration state
  const [icpConfig, setIcpConfig] = useState({
    titles: '',
    industries: '',
    companySize: '',
    location: '',
    keywords: '',
  })
  const [segments, setSegments] = useState<Segment[]>([])
  const [scheduleConfig, setScheduleConfig] = useState({
    dailyLimit: 25,
    followUpDelay: 3,
    activeHoursStart: '9',
    activeHoursEnd: '17',
  })
  const [configSaved, setConfigSaved] = useState(false)

  // Discovery state
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [selectedProspects, setSelectedProspects] = useState<Set<number>>(new Set())

  // Outreach state
  const [outreachResults, setOutreachResults] = useState<OutreachResult[]>([])
  const [campaignSummary, setCampaignSummary] = useState<CampaignSummary | null>(null)
  const [campaignPaused, setCampaignPaused] = useState(false)

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<{ metrics: Metrics; segment_breakdown: SegmentBreakdown[]; recommendations: Recommendation[] } | null>(null)

  // Loading state
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  const handleSaveConfig = useCallback(() => {
    setConfigSaved(true)
    setTimeout(() => setConfigSaved(false), 3000)
  }, [])

  // Sample data toggle effect
  useEffect(() => {
    if (sampleDataOn) {
      if (icpConfig.titles === '' && icpConfig.industries === '') {
        setIcpConfig({
          titles: 'VP of Engineering, Director of Sales, Head of Marketing, CTO, Founder & CEO',
          industries: 'Technology, SaaS, FinTech, Artificial Intelligence, Marketing',
          companySize: '51-200',
          location: 'United States',
          keywords: 'AI, automation, B2B, growth, pipeline optimization',
        })
      }
      if (segments.length === 0) {
        setSegments([
          {
            id: 'sample-1',
            name: 'Enterprise Tech',
            criteria: 'VP+ roles at tech companies with 200+ employees, recent funding rounds',
            connectionNote: 'Hi {first_name}, your work at {company} in scaling engineering teams is impressive. We help leaders like you automate prospect identification using AI. Would love to connect.',
            followUp1: 'Thanks for connecting! We recently helped a company similar to {company} save 10hrs/week on prospecting. Worth a quick chat?',
            followUp2: 'Quick follow-up, {first_name}. Just published a case study that might resonate with your team at {company}. Happy to share.',
            followUp3: '',
          },
          {
            id: 'sample-2',
            name: 'Mid-Market SaaS',
            criteria: 'Director+ roles at SaaS companies with 50-500 employees focused on growth',
            connectionNote: '{first_name}, your insights on {title} are spot on. We built something that aligns with your growth philosophy. Let\'s connect?',
            followUp1: 'Thanks for connecting! Your recent post on pipeline optimization resonated. Our tool automates the prospect discovery part. Interested in a demo?',
            followUp2: '',
            followUp3: '',
          },
        ])
      }
    }
  }, [sampleDataOn])

  return (
    <ErrorBoundary>
      <TooltipProvider>
        <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, hsl(210 20% 97%) 0%, hsl(220 25% 95%) 35%, hsl(200 20% 96%) 70%, hsl(230 15% 97%) 100%)' }}>
          {/* Sidebar */}
          <SidebarNav activeScreen={activeScreen} onNavigate={setActiveScreen} activeAgentId={activeAgentId} />

          {/* Main Content */}
          <main className="flex-1 min-h-screen overflow-y-auto">
            {/* Top Bar */}
            <header className="sticky top-0 z-10 backdrop-blur-[16px] bg-white/60 border-b border-border px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold text-foreground">LinkedIn ICP Outreach</h1>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${linkedInConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-xs text-muted-foreground">{linkedInConnected ? 'Connected' : 'Disconnected'}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="sample-toggle" className="text-sm text-muted-foreground cursor-pointer">Sample Data</Label>
                <Switch id="sample-toggle" checked={sampleDataOn} onCheckedChange={setSampleDataOn} />
              </div>
            </header>

            {/* Content Area */}
            <div className="p-6 max-w-6xl mx-auto">
              {activeScreen === 'configuration' && (
                <ConfigurationScreen
                  icpConfig={icpConfig}
                  setIcpConfig={setIcpConfig}
                  segments={segments}
                  setSegments={setSegments}
                  scheduleConfig={scheduleConfig}
                  setScheduleConfig={setScheduleConfig}
                  configSaved={configSaved}
                  onSave={handleSaveConfig}
                />
              )}
              {activeScreen === 'discovery' && (
                <DiscoveryScreen
                  icpConfig={icpConfig}
                  prospects={prospects}
                  setProspects={setProspects}
                  selectedProspects={selectedProspects}
                  setSelectedProspects={setSelectedProspects}
                  loading={loading}
                  setLoading={setLoading}
                  activeAgentId={activeAgentId}
                  setActiveAgentId={setActiveAgentId}
                  sampleDataOn={sampleDataOn}
                />
              )}
              {activeScreen === 'outreach' && (
                <OutreachScreen
                  prospects={sampleDataOn && prospects.length === 0 ? SAMPLE_PROSPECTS : prospects}
                  selectedProspects={sampleDataOn && selectedProspects.size === 0 ? new Set(SAMPLE_PROSPECTS.map((_, i) => i)) : selectedProspects}
                  segments={segments}
                  scheduleConfig={scheduleConfig}
                  outreachResults={outreachResults}
                  setOutreachResults={setOutreachResults}
                  campaignSummary={campaignSummary}
                  setCampaignSummary={setCampaignSummary}
                  loading={loading}
                  setLoading={setLoading}
                  campaignPaused={campaignPaused}
                  setCampaignPaused={setCampaignPaused}
                  setActiveAgentId={setActiveAgentId}
                  sampleDataOn={sampleDataOn}
                />
              )}
              {activeScreen === 'analytics' && (
                <AnalyticsScreen
                  analyticsData={analyticsData}
                  setAnalyticsData={setAnalyticsData}
                  outreachResults={sampleDataOn && outreachResults.length === 0 ? SAMPLE_OUTREACH : outreachResults}
                  segments={segments}
                  loading={loading}
                  setLoading={setLoading}
                  setActiveAgentId={setActiveAgentId}
                  sampleDataOn={sampleDataOn}
                />
              )}
            </div>
          </main>
        </div>
      </TooltipProvider>
    </ErrorBoundary>
  )
}
