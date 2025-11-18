import React, { useMemo, useState, useEffect } from 'react'
import { getFunnel, getEventSummary, getActiveUsers, getRetention, getEngagementReport } from './api.js'
import { motion, AnimatePresence } from 'framer-motion'

function formatPercent(value) {
  if (value == null || Number.isNaN(value)) return '-'
  return (value * 100).toFixed(1) + '%'
}   

function formatNumber(num) {
  if (num == null) return '0'
  return new Intl.NumberFormat('en-US').format(num)
}

function formatRetentionPeriod(periodStart, periodType = 'daily') {
  if (!periodStart) return '-'
  const d = new Date(periodStart)
  if (Number.isNaN(d.getTime())) return String(periodStart)
  if (periodType === 'monthly') {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }
  if (periodType === 'weekly') {
    return `Week of ${d.toISOString().slice(0, 10)}`
  }
  return d.toISOString().slice(0, 10)
}

function RetentionChart({ title, rows, periodType = 'daily' }) {
  const hasData = Array.isArray(rows) && rows.length > 0
  if (!hasData) {
    return <div style={styles.retentionEmpty}>Not enough data yet</div>
  }

  const sorted = [...rows].sort((a, b) => {
    const aDate = new Date(a.period_start?.value || a.period_start)
    const bDate = new Date(b.period_start?.value || b.period_start)
    return aDate - bDate
  })

  const w = 520
  const h = 220
  const padding = { top: 32, right: 32, bottom: 48, left: 60 }
  const innerW = w - padding.left - padding.right
  const innerH = h - padding.top - padding.bottom

  const maxRetention = Math.max(...sorted.map(r => Number(r.retention_rate || 0)), 0.01)
  const points = sorted.map((row, idx) => {
    const date = new Date(row.period_start?.value || row.period_start)
    const x = padding.left + (idx / Math.max(1, sorted.length - 1)) * innerW
    const y = padding.top + innerH - ((row.retention_rate || 0) / maxRetention) * innerH
    return { x, y, date, row, idx }
  })

  const path = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const [hover, setHover] = React.useState(null)

  return (
    <div style={styles.retentionChartWrapper}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={`${title} retention`}>
        <defs>
          <linearGradient id={`retention-${title}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#667eea" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#667eea" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={w} height={h} rx="14" fill="#fafbff" />
        {/* grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((val) => {
          const y = padding.top + innerH - val * innerH
          return (
            <g key={val}>
              <line x1={padding.left} y1={y} x2={w - padding.right} y2={y} stroke="#e4e6f1" strokeDasharray="4 6" />
              <text x={padding.left - 6} y={y + 4} fontSize="10" textAnchor="end" fill="#7a7f95">
                {formatPercent(val * maxRetention)}
              </text>
            </g>
          )
        })}
        {/* axis labels */}
        {sorted.map((row, idx) => {
          if (sorted.length > 6 && idx % Math.ceil(sorted.length / 6) !== 0 && idx !== sorted.length - 1) return null
          const date = formatRetentionPeriod(row.period_start?.value || row.period_start, periodType)
          const x = padding.left + (idx / Math.max(1, sorted.length - 1)) * innerW
          return (
            <g key={`tick-${idx}`}>
              <line x1={x} y1={h - padding.bottom} x2={x} y2={h - padding.bottom + 6} stroke="#cfd2e4" />
              <text x={x} y={h - padding.bottom + 20} fontSize="10" textAnchor="middle" fill="#7a7f95">{date}</text>
            </g>
          )
        })}
        {/* area */}
        <path d={`${path} L ${w - padding.right} ${h - padding.bottom} L ${padding.left} ${h - padding.bottom} Z`} fill={`url(#retention-${title})`} />
        {/* line */}
        <path d={path} fill="none" stroke="#667eea" strokeWidth="3" />
        {/* points */}
        {points.map((p) => (
          <circle
            key={p.idx}
            cx={p.x}
            cy={p.y}
            r={4}
            fill="#fff"
            stroke="#667eea"
            strokeWidth="2"
            onMouseEnter={() => setHover(p)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        {hover && (
          <g transform={`translate(${hover.x}, ${hover.y - 45})`} pointerEvents="none">
            <rect x="-70" y="-32" width="140" height="32" rx="8" fill="rgba(22, 27, 65, 0.85)" />
            <text x="0" y="-15" textAnchor="middle" fill="#fff" fontSize="11">{formatRetentionPeriod(hover.date, periodType)}</text>
            <text x="0" y="-3" textAnchor="middle" fill="#fff" fontSize="11"><tspan fontWeight="700">{formatPercent(hover.row.retention_rate)}</tspan> retention</text>
          </g>
        )}
      </svg>
      <div style={styles.retentionChartMeta}>
        <div>
          <div style={styles.retentionChartLabel}>{title}</div>
          <div style={styles.retentionChartValue}>{formatPercent(sorted.at(-1)?.retention_rate)}</div>
          <div style={styles.retentionChartSub}>latest cohort</div>
        </div>
        <div>
          <div style={styles.retentionChartLabel}>Cohort size</div>
          <div style={styles.retentionChartValue}>{formatNumber(sorted.at(-1)?.cohort_size || 0)}</div>
          <div style={styles.retentionChartSub}>latest</div>
        </div>
      </div>
    </div>
  )
}

function RetentionTable({ title, rows, periodType = 'daily' }) {
  const hasData = Array.isArray(rows) && rows.length > 0

  return (
    <div style={styles.retentionCard}>
      <div style={styles.retentionTitle}>{title}</div>
      {!hasData ? (
        <div style={styles.retentionEmpty}>Not enough data yet</div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={styles.tableHeaderCell}>Cohort Start</th>
                <th style={{ ...styles.tableHeaderCell, ...styles.tableHeaderCellRight }}>Cohort Size</th>
                <th style={{ ...styles.tableHeaderCell, ...styles.tableHeaderCellRight }}>Returned Users</th>
                <th style={{ ...styles.tableHeaderCell, ...styles.tableHeaderCellRight }}>Retention</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${title}-${row.period_start}`} style={styles.tableRow}>
                  <td style={styles.tableCell}>{formatRetentionPeriod(row.period_start, periodType)}</td>
                  <td style={{ ...styles.tableCell, ...styles.tableCellRight }}>{formatNumber(row.cohort_size || 0)}</td>
                  <td style={{ ...styles.tableCell, ...styles.tableCellRight }}>{formatNumber(row.retained_users || 0)}</td>
                  <td style={{ ...styles.tableCell, ...styles.tableCellRight }}>{formatPercent(row.retention_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function EventsBarChart({ data }) {
  const TARGET_EVENTS = [
    'communityToggleLike',
    'communityNewPost',
    'communityNewComment',
    'communityLoadMorePosts',
    'communitySelectedPostTab',
    'communityShowAllPosts',
    'communityNotificationIconClicked',
    'communityNotificationClicked',
    'communityNotificationMarkAllAsRead',
    'communityNotificationSelectedTab',
  ]

  const itemsMap = Object.create(null)
  for (const row of (data || [])) {
    itemsMap[row.name] = row
  }
  const items = TARGET_EVENTS.map((name) => ({
    name,
    event_count: Number(itemsMap[name]?.event_count || 0),
    user_count: Number(itemsMap[name]?.user_count || 0),
  }))

  const maxVal = Math.max(1, ...items.map(i => Math.max(i.event_count, i.user_count)))
  const w = 900
  const h = 360
  const padding = { top: 24, right: 24, bottom: 56, left: 180 }
  const innerW = w - padding.left - padding.right
  const barGap = 10
  const rowH = Math.max(20, Math.floor((h - padding.top - padding.bottom) / items.length))
  const barHeight = Math.max(10, rowH - barGap)

  const [hover, setHover] = React.useState(null)

  return (
    <div>
    <svg viewBox={`0 0 ${w} ${h}`} width="100%"  role="img" aria-label="Community events bar chart">
      <defs>
        <linearGradient id="evGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#667eea" />
          <stop offset="100%" stopColor="#764ba2" />
        </linearGradient>
        <linearGradient id="usGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      {/* y labels */}
      {items.map((it, idx) => (
        <text key={`label-${it.name}`} x={padding.left - 8} y={padding.top + idx * rowH + barHeight / 2 + 4} textAnchor="end" fontSize="12" fill="#333">
          {it.name}
        </text>
      ))}
      {/* baseline */}
      <line x1={padding.left} y1={h - padding.bottom} x2={w - padding.right} y2={h - padding.bottom} stroke="#eee" />
      {items.map((it, idx) => {
        const y = padding.top + idx * rowH
        const evW = (it.event_count / maxVal) * innerW
        const usW = (it.user_count / maxVal) * innerW
        const evX = padding.left
        const usX = padding.left
        return (
          <g key={it.name}>
            {/* Event bar */}
            <rect x={evX} y={y} width={evW} height={Math.floor(barHeight / 2) - 2} fill="url(#evGrad)" rx="4"
              onMouseEnter={(e) => setHover({ x: evX + evW, y, name: it.name, ev: it.event_count, us: it.user_count })}
              onMouseLeave={() => setHover(null)} />
            {/* User bar */}
            <rect x={usX} y={y + Math.floor(barHeight / 2) + 2} width={usW} height={Math.floor(barHeight / 2) - 2} fill="url(#usGrad)" rx="4"
              onMouseEnter={(e) => setHover({ x: usX + usW, y: y + Math.floor(barHeight / 2) + 2, name: it.name, ev: it.event_count, us: it.user_count })}
              onMouseLeave={() => setHover(null)} />
          </g>
        )
      })}
      {/* percentage scale removed */}
      {/* legend moved to bottom */}
      {/* tooltip */}
      {hover && (() => {
        const boxW = 180
        const boxH = 50
        const tx = Math.min(Math.max(hover.x + 8, padding.left), w - boxW - 4)
        const ty = Math.max(hover.y - boxH / 2, 4)
        return (
          <g transform={`translate(${tx}, ${ty})`} pointerEvents="none">
            <rect x="0" y="0" width={boxW} height={boxH} rx="6" ry="6" fill="rgba(0,0,0,0.75)" />
            <text x="8" y="16" fill="#fff" fontSize="12" fontWeight="700">{hover.name}</text>
            <text x="8" y="32" fill="#fff" fontSize="11">Events: {formatNumber(hover.ev)} • Users: {formatNumber(hover.us)}</text>
          </g>
        )
      })()}
    </svg>
    {/* bottom graphic symbols */}
    <div style={{ display: 'flex', justifyContent: 'center', gap: 16, alignItems: 'center' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <defs>
            <linearGradient id="evGradLegend" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#667eea" />
              <stop offset="100%" stopColor="#764ba2" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="12" height="12" rx="3" ry="3" fill="url(#evGradLegend)" />
        </svg>
        <span style={{ fontSize: 12, color: '#333' }}>Event count</span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <defs>
            <linearGradient id="usGradLegend" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="12" height="12" rx="3" ry="3" fill="url(#usGradLegend)" />
        </svg>
        <span style={{ fontSize: 12, color: '#333' }}>User count</span>
      </span>
    </div>
    </div>
  )
}

function MiniLineChart({ series, width = '100%', height = 120, distinctTotal = 0, period = 'daily' }) {
  const padding = 24
  const points = (series || []).map((d, i) => ({ idx: i, x: new Date(d.date).getTime(), y: Number(d.active_users || 0), raw: d }))
  if (points.length === 0) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>No data</div>
  }
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = 0
  const maxY = Math.max(...ys)

  const w = 400
  const h = typeof height === 'number' ? height : 140
  const innerW = w - padding * 2
  const innerH = h - padding * 2

  const scaleX = (x) => padding + ((x - minX) / Math.max(1, (maxX - minX))) * innerW
  const scaleY = (y) => padding + innerH - ((y - minY) / Math.max(1, (maxY - minY))) * innerH

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p.y)}`)
    .join(' ')

  const [hover, setHover] = React.useState(null)
  function formatDateStr(s) {
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return String(s)
    return d.toISOString().slice(0, 10)
  }
  function formatAxisLabel(s) {
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return String(s)
    if (period === 'monthly') {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    }
    // daily and weekly: show MM-DD to reduce overlap
    return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={width} height={h} role="img" aria-label="Line chart">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopOpacity="0.4" stopColor="#667eea" />
          <stop offset="100%" stopOpacity="0" stopColor="#667eea" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={w} height={h} fill="#fff" rx="8" ry="8" />
      <path d={path} fill="none" stroke="#667eea" strokeWidth="2" />
      {/* Area */}
      <path d={`${path} L ${scaleX(maxX)} ${scaleY(0)} L ${scaleX(minX)} ${scaleY(0)} Z`} fill="url(#lineGrad)" opacity="0.5" />
      {/* Axis - simple baseline */}
      <line x1={padding} y1={h - padding} x2={w - padding} y2={h - padding} stroke="#eee" />
      {/* X axis labels (sparse) */}
      {(() => {
        const showAll = period === 'weekly'
        const count = showAll ? points.length : Math.min(5, points.length)
        if (count <= 1) return null
        const step = showAll ? 1 : (Math.floor((points.length - 1) / (count - 1)) || 1)
        return (
          <g>
            {Array.from({ length: count }).map((_, i) => {
              const idx = showAll ? i : Math.min(points.length - 1, i * step)
              const p = points[idx]
              const cx = scaleX(p.x)
              return (
                <g key={`tick-${idx}`}>
                  <line x1={cx} y1={h - padding} x2={cx} y2={h - padding + 4} stroke="#bbb" />
                  <text x={cx} y={h - padding + 16} fontSize="10" textAnchor="middle" fill="#666">{formatAxisLabel(p.raw.date)}</text>
                </g>
              )
            })}
          </g>
        )
      })()}
      {/* Dots */}
      {points.map((p, i) => {
        const cx = scaleX(p.x)
        const cy = scaleY(p.y)
        return (
          <g key={i} onMouseEnter={() => setHover({ cx, cy, date: p.raw.date, value: p.y, idx: p.idx })} onMouseLeave={() => setHover(null)}>
            <circle cx={cx} cy={cy} r="3" fill="#667eea" />
          </g>
        )
      })}
      {hover && (() => {
        // Compare against previous point; for weekly/monthly this corresponds to last week/month
        const prev = hover.idx > 0 ? points[hover.idx - 1].y : null
        const diff = prev == null ? null : (hover.value - prev)
        // Active User Percentage Formula:
        // (active users on particular date/week/month) ÷ (users who selected community menu)
        const percent = distinctTotal > 0 ? hover.value / distinctTotal : 0
        const boxW = 190
        const boxH = 58
        const tx = Math.min(Math.max(hover.cx - boxW / 2, 4), w - boxW - 4)
        const ty = Math.max(hover.cy - (boxH + 10), 4)
        return (
          <g transform={`translate(${tx}, ${ty})`} pointerEvents="none">
            <rect x="0" y="0" width={boxW} height={boxH} rx="6" ry="6" fill="rgba(0,0,0,0.75)" />
            <text x="8" y="14" fill="#fff" fontSize="11" fontFamily="system-ui, -apple-system, Segoe UI, Roboto">{formatDateStr(hover.date)}</text>
            <text x="8" y="26" fill="#fff" fontSize="12" fontWeight="700" fontFamily="system-ui, -apple-system, Segoe UI, Roboto">{formatNumber(hover.value)} users</text>
            <text x="8" y="40" fill="#fff" fontSize="11" fontFamily="system-ui, -apple-system, Segoe UI, Roboto">{formatPercent(percent)} of active users{diff == null ? '' : ` • ${diff >= 0 ? '+' : ''}${formatNumber(diff)} vs last ${period === 'monthly' ? 'month' : period === 'weekly' ? 'week' : 'day'}`}</text>
          </g>
        )
      })()}
    </svg>
  )
}

const styles = {
  container: {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial, sans-serif',
    minHeight: '100vh',
    background: 'linear-gradient(135deg,rgb(135, 188, 242) 0%,rgb(247, 203, 72) 100%)',
    padding: '24px',
  },
  funnelSection: {
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)'
  },
  funnelTitle: {
    margin: '0 0 20px 0',
    fontSize: '24px',
    fontWeight: 700,
    color: '#333',
    textAlign: 'center',
    borderBottom: '2px solid #f0f0f0',
    paddingBottom: '12px'
  },
  funnelWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px'
  },
  funnelContainer: {
    position: 'relative',
    width: '280px',
    padding: '16px 12px',
    borderRadius: '12px',
    background: '#fafbff',
    border: '1px solid #eef0f5'
  },
  funnelStepsCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  funnelStepTrack: {
    height: '48px',
    background: '#f0f2f8',
    borderRadius: '10px',
    position: 'relative',
    overflow: 'hidden',
    outline: '1px solid rgba(0,0,0,0.03)',
    cursor: 'pointer'
  },
  funnelStepFillBase: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: '12px',
    transition: 'width 0.35s ease, opacity 0.2s'
  },
  funnelStepRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    marginTop: '4px'
  },
  funnelStepLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#4b4f5c',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  funnelStepValue: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#2d2f36',
    fontFamily: 'monospace'
  },
  funnelPerc: {
    fontSize: '11px',
    color: '#667085',
    textAlign: 'center'
  },
  funnelConv: {
    fontSize: '11px',
    color: '#667085',
    textAlign: 'center',
    marginTop: '2px'
  },
  funnelLegend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    justifyContent: 'center',
    alignItems: 'center'
  },
  legendDot: {
    display: 'inline-block',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    marginRight: '6px'
  },
  tooltip: {
    position: 'absolute',
    right: '8px',
    top: '8px',
    background: 'rgba(0,0,0,0.75)',
    color: '#fff',
    fontSize: '12px',
    padding: '6px 8px',
    borderRadius: '6px',
    pointerEvents: 'none'
  },
  wrapper: {
    maxWidth: '1400px',
    margin: '0 auto',
  },
  header: {
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
  },
  headerTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '28px',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    margin: 0,
    color: '#666',
    fontSize: '12px',
  },
  controls: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  controlsRight: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    padding: '10px 14px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '14px',
    transition: 'all 0.2s',
    outline: 'none',
  },
  button: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  error: {
    color: '#e74c3c',
    fontSize: '14px',
    padding: '8px 12px',
    background: '#fee',
    borderRadius: '6px',
    border: '1px solid #e74c3c',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '20px',
    marginBottom: '24px',
  },
  metricCard: {
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  metricCardHover: {
    transform: 'translateY(-4px)',
    boxShadow: '0 15px 50px rgba(0, 0, 0, 0.15)',
  },
  metricLabel: {
    fontSize: '13px',
    color: '#666',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '12px',
  },
  metricValue: {
    fontSize: '36px',
    fontWeight: 700,
    color: '#333',
    margin: 0,
  },
  section: {
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '16px',
    padding: '32px',
    marginBottom: '24px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
  },
  sectionHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '2px solid #f0f0f0',
    paddingBottom: '12px',
    marginBottom: '24px',
  },
  sectionTitle: {
    margin: '0 0 24px 0',
    fontSize: '24px',
    fontWeight: 700,
    color: '#333',
    borderBottom: '2px solid #f0f0f0',
    paddingBottom: '12px',
  },
  sectionTitleNoBorder: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 700,
    color: '#333',
  },
  tableGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '24px',
  },
  tableContainer: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableHeader: {
    background: '#f8f9fa',
    borderBottom: '2px solid #e0e0e0',
  },
  tableHeaderCell: {
    textAlign: 'left',
    padding: '12px 16px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tableHeaderCellRight: {
    textAlign: 'right',
  },
  tableRow: {
    borderBottom: '1px solid #f0f0f0',
    transition: 'background 0.15s',
  },
  tableRowHover: {
    background: '#f8f9fa',
  },
  tableCell: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#333',
  },
  tableCellRight: {
    textAlign: 'right',
    fontFamily: 'monospace',
  },
  retentionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '20px',
  },
  retentionChartsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: '24px',
  },
  retentionCard: {
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.4)',
  },
  retentionChartWrapper: {
    background: 'rgba(255,255,255,0.95)',
    borderRadius: '16px',
    padding: '12px',
    border: '1px solid #edf0fb',
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  retentionChartMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0 8px 8px',
  },
  retentionChartLabel: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#a0a4b8',
  },
  retentionChartValue: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#121539',
  },
  retentionChartSub: {
    fontSize: '11px',
    color: '#868aa5',
  },
  retentionDetailsToggle: {
    border: '1px solid #d7dbef',
    background: '#fff',
    borderRadius: '999px',
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#4a4f63',
    cursor: 'pointer',
    boxShadow: '0 3px 8px rgba(15,23,42,0.1)',
    transition: 'all 0.2s ease',
  },
  retentionTitle: {
    fontSize: '16px',
    fontWeight: 700,
    marginBottom: '12px',
    color: '#333',
  },
  retentionEmpty: {
    color: '#999',
    fontSize: '14px',
    padding: '16px 0',
  },
  // Alternate funnel (horizontal compact bars)
  altFunnelSection: {
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)'
  },
  altTitle: {
    margin: '0 0 16px 0',
    fontSize: '20px',
    fontWeight: 700,
    color: '#333',
    textAlign: 'left'
  },
  altBarCol: {
    display: 'grid',
    gridTemplateColumns: '160px 1fr 80px',
    gap: '10px',
    alignItems: 'center'
  },
  altBarRow: {
    display: 'contents'
  },
  altBarLabel: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#4b4f5c',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    textAlign: 'right'
  },
  altBarTrack: {
    height: '12px',
    background: '#eef2ff',
    borderRadius: '9999px',
    position: 'relative',
    overflow: 'hidden',
    outline: '1px solid rgba(0,0,0,0.03)'
  },
  altBarFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: '9999px',
    transition: 'width 0.3s ease'
  },
  altBarValue: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#2d2f36',
    fontFamily: 'monospace',
    textAlign: 'left'
  },
}

export default function App() {
  const todayIso = new Date().toISOString().slice(0, 10)
  const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const [startDate, setStartDate] = useState(weekAgoIso)
  const [endDate, setEndDate] = useState(todayIso)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [funnel, setFunnel] = useState(null)
  const [summary, setSummary] = useState([])
  const [active, setActive] = useState({ daily: [], weekly: [], monthly: [], total_distinct_daily: 0, total_distinct_weekly: 0, total_distinct_monthly: 0 })
const [hoverStep, setHoverStep] = useState('')
  const [retention, setRetention] = useState({ daily: [], weekly: [], monthly: [] })
  const [engagementReport, setEngagementReport] = useState({ inactive_users: 0, new_users: 0 })
const [showRetentionDetails, setShowRetentionDetails] = useState(false)

  const startParam = useMemo(() => `${startDate}T00:00:00Z`, [startDate])
  const endParam = useMemo(() => `${endDate}T23:59:59Z`, [endDate])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [funnelRes, summaryRes, activeRes, retentionRes, engagementRes] = await Promise.all([
        getFunnel(startParam, endParam),
        getEventSummary(startParam, endParam),
        getActiveUsers(startParam, endParam),
        getRetention(startParam, endParam),
        getEngagementReport(startParam, endParam),
      ])
      setFunnel(funnelRes)
      setSummary(summaryRes.events || [])
      setActive({
        daily: activeRes.daily || [],
        weekly: activeRes.weekly || [],
        monthly: activeRes.monthly || [],
        total_distinct_daily: activeRes.total_distinct_daily || 0,
        total_distinct_weekly: activeRes.total_distinct_weekly || 0,
        total_distinct_monthly: activeRes.total_distinct_monthly || 0,
      })
      setRetention({
        daily: retentionRes?.daily || [],
        weekly: retentionRes?.weekly || [],
        monthly: retentionRes?.monthly || [],
      })
      setEngagementReport({
        inactive_users: Number(engagementRes?.inactive_users || 0),
        new_users: Number(engagementRes?.new_users || 0),
      })
    } catch (e) {
      setError(e?.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  // Auto-load on mount
  useEffect(() => {
    load()
  }, [])

  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        <motion.header style={styles.header} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: 'easeOut' }}>
          <div style={styles.headerTop}>
            <div>
              <h1 style={styles.title}>User Engagement Dashboard</h1>
              <p style={styles.subtitle}>Track user engagement metrics and funnel conversion rates</p>
            </div>
            <div style={styles.controlsRight}>
              <div style={styles.inputGroup}>
                <label htmlFor="start" style={styles.label}>Start Date</label>
                <input
                  id="start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={styles.input}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                />
              </div>
              <div style={styles.inputGroup}>
                <label htmlFor="end" style={styles.label}>End Date</label>
                <input
                  id="end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={styles.input}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                />
              </div>
              <button
                onClick={load}
                disabled={loading}
                style={{
                  ...styles.button,
                  ...(loading ? styles.buttonDisabled : {}),
                }}
                onMouseEnter={(e) => !loading && (e.target.style.transform = 'scale(1.05)')}
                onMouseLeave={(e) => !loading && (e.target.style.transform = 'scale(1)')}
              >
                {loading ? 'Loading…' : 'Load Data'}
              </button>
            </div>
          </div>
          {error && <div style={{ ...styles.error, marginTop: 16 }}>{error}</div>}
        </motion.header>

        {funnel && (
          <>
            <motion.section style={styles.section} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
              <h2 style={styles.sectionTitle}>Key Metrics</h2>
              <div style={styles.metricsGrid}>
            <motion.div style={styles.metricCard} whileHover={{ y: -4, boxShadow: '0 15px 50px rgba(0, 0, 0, 0.15)' }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
              <div style={styles.metricLabel}>Total Users</div>
              <div style={styles.metricValue}>{formatNumber(funnel.total_users ?? 0)}</div>
            </motion.div>
                <motion.div style={styles.metricCard} whileHover={{ y: -4, boxShadow: '0 15px 50px rgba(0, 0, 0, 0.15)' }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                  <div style={styles.metricLabel}>Selected Community Menu</div>
                  <div style={styles.metricValue}>{formatNumber(funnel.total_step1_users ?? 0)}</div>
                </motion.div>
                <motion.div style={styles.metricCard} whileHover={{ y: -4, boxShadow: '0 15px 50px rgba(0, 0, 0, 0.15)' }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                  <div style={styles.metricLabel}>Active Users</div>
                  <div style={styles.metricValue}>{formatNumber(funnel.total_engaged_users ?? 0)}</div>
                </motion.div>
                <motion.div style={styles.metricCard} whileHover={{ y: -4, boxShadow: '0 15px 50px rgba(0, 0, 0, 0.15)' }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                  <div style={styles.metricLabel}>Conversion Rate</div>
                  <div style={styles.metricValue}>{formatPercent(funnel.conversion_rate)}</div>
                </motion.div>
              </div>
            </motion.section>

            <motion.section style={styles.section} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut', delay: 0.05 }}>
              <h2 style={styles.sectionTitle}>Engagement Health</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                <motion.div style={{ ...styles.metricCard, background: '#fff8f0' }} whileHover={{ y: -4, boxShadow: '0 15px 40px rgba(255, 148, 77, 0.25)' }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                  <div style={{ ...styles.metricLabel, color: '#c05621' }}>Previously Active but Inactive Now</div>
                  <div style={{ ...styles.metricValue, color: '#c05621' }}>{formatNumber(engagementReport.inactive_users)}</div>
                  <p style={{ margin: 0, color: '#c05621', fontSize: 12 }}>Users who were active before the selected range but dormant now</p>
                </motion.div>
                <motion.div style={{ ...styles.metricCard, background: '#f0fff4' }} whileHover={{ y: -4, boxShadow: '0 15px 40px rgba(72, 187, 120, 0.25)' }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                  <div style={{ ...styles.metricLabel, color: '#276749' }}>Newly Engaged Users</div>
                  <div style={{ ...styles.metricValue, color: '#276749' }}>{formatNumber(engagementReport.new_users)}</div>
                  <p style={{ margin: 0, color: '#276749', fontSize: 12 }}>Users whose first engagement happened within this range</p>
                </motion.div>
              </div>
            </motion.section>

            {/* Vertical Funnel removed per request */}

            {/* Alternate Funnel Visualization (Horizontal) */}
            <motion.section style={styles.altFunnelSection} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut', delay: 0.05 }}>
              <h2 style={styles.altTitle}>Conversion Funnel</h2>
              {(() => {
                const total = Math.max(1, Number(funnel.total_users ?? 0))
                const step1 = Number(funnel.total_step1_users ?? 0)
                const step2 = Number(funnel.total_engaged_users ?? 0)
                const pctAll = 1
                const pctS1 = (step1 || 0) / total
                const pctS2 = Math.max(0, Number(funnel.conversion_rate ?? 0))

                return (
                  <div style={{ display: 'grid', rowGap: 10 }}>
                    <div style={styles.altBarCol}>
                      <div style={styles.altBarLabel}>All users</div>
                      <div style={styles.altBarTrack}>
                        <motion.div style={{
                          ...styles.altBarFill,
                          background: 'linear-gradient(90deg, #fecdd3 0%, #fb7185 100%)'
                        }} initial={{ width: 0 }} animate={{ width: `${Math.round(pctAll * 100)}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
                      </div>
                      <div style={styles.altBarValue}>{formatNumber(funnel.total_users ?? 0)} • {formatPercent(pctAll)}</div>
                    </div>

                    <div style={styles.altBarCol}>
                      <div style={styles.altBarLabel}>Selected Community Menu</div>
                      <div style={styles.altBarTrack}>
                        <motion.div style={{
                          ...styles.altBarFill,
                          background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
                        }} initial={{ width: 0 }} animate={{ width: `${Math.round(pctS1 * 100)}%` }} transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }} />
                      </div>
                      <div style={styles.altBarValue}>{formatNumber(step1)} • {formatPercent(pctS1)}</div>
                    </div>

                    <div style={styles.altBarCol}>
                      <div style={styles.altBarLabel}>Active users</div>
                      <div style={styles.altBarTrack}>
                        <motion.div style={{
                          ...styles.altBarFill,
                          background: 'linear-gradient(90deg, #34d399 0%, #10b981 100%)'
                        }} initial={{ width: 0 }} animate={{ width: `${Math.round(pctS2 * 100)}%` }} transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }} />
                      </div>
                      <div style={styles.altBarValue}>{formatNumber(step2)} • {formatPercent(pctS2)}</div>
                    </div>
                  </div>
                )
              })()}
            </motion.section>

            {/* Daily Breakdown removed per request */}

            {/* Active Users Charts */}
            <motion.section style={styles.section} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}>
              <h2 style={styles.sectionTitle}>Active Users</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {[
                  { key: 'daily', title: 'Daily Active Users', data: active.daily, distinctTotal: Number(active.total_distinct_daily || 0) },
                  { key: 'weekly', title: 'Weekly Active Users', data: active.weekly, distinctTotal: Number(active.total_distinct_weekly || 0) },
                  { key: 'monthly', title: 'Monthly Active Users', data: active.monthly, distinctTotal: Number(active.total_distinct_monthly || 0) },
                ].map(({ key, title, data, distinctTotal }) => (
                  <motion.div key={key} style={{ background: 'white', border: '1px solid #eee', borderRadius: 12, padding: 12 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }} whileHover={{ scale: 1.01 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{title}</div>
                    <MiniLineChart series={data} height={160} distinctTotal={distinctTotal} period={key} />
                  </motion.div>
                ))}
              </div>
            </motion.section>

            <motion.section style={styles.section} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut', delay: 0.12 }}>
              <div style={styles.sectionHeaderRow}>
                <h2 style={styles.sectionTitleNoBorder}>User Retention</h2>
                <button
                  type="button"
                  style={styles.retentionDetailsToggle}
                  onClick={() => setShowRetentionDetails((prev) => !prev)}
                >
                  {showRetentionDetails ? 'Hide' : 'Show'} report {showRetentionDetails ? '▲' : '▼'}
                </button>
              </div>
              {showRetentionDetails && (
                <>
                  <div style={styles.retentionChartsRow}>
                    <RetentionChart title="Daily" rows={retention.daily} periodType="daily" />
                    <RetentionChart title="Weekly" rows={retention.weekly} periodType="weekly" />
                    <RetentionChart title="Monthly" rows={retention.monthly} periodType="monthly" />
                  </div>
                  <div style={{ marginTop: 32 }}>
                    <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#333' }}>Detailed Retention Data</div>
                    <div style={styles.retentionGrid}>
                      <RetentionTable title="Daily Cohorts" rows={retention.daily} periodType="daily" />
                      <RetentionTable title="Weekly Cohorts" rows={retention.weekly} periodType="weekly" />
                      <RetentionTable title="Monthly Cohorts" rows={retention.monthly} periodType="monthly" />
                    </div>
                  </div>
                </>
              )}
            </motion.section>
          </>
        )}

        {/* Engaged Events Summary removed per request */}

        {funnel && (
          <motion.section style={styles.section} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut', delay: 0.15 }}>
            <h2 style={styles.sectionTitle}>Community Events Report</h2>
            <EventsBarChart data={summary} />
          </motion.section>
        )}
      </div>
    </div>
  )
}
