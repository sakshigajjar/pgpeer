import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'

function formatMonth(monthStr) {
  if (!monthStr) return ''
  const [year, month] = monthStr.split('-')
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1)
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

function TrendChart({ data }) {
  const totalReviews = data.reduce((sum, d) => sum + d.review_count, 0)
  const months = data.length

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 16, right: 16, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fill: '#6b7280', fontSize: 12 }} />
          <YAxis domain={[0, 5]} tickCount={6} tick={{ fill: '#6b7280', fontSize: 12 }} />
          <Tooltip
            labelFormatter={formatMonth}
            formatter={(value) => [value, 'Avg overall']}
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
          />
          <Line
            type="monotone"
            dataKey="avg_overall"
            stroke="#4f46e5"
            strokeWidth={2}
            dot={{ r: 4, fill: '#4f46e5' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-center text-xs text-gray-500 mt-2">
        Based on {totalReviews} review{totalReviews !== 1 ? 's' : ''} across {months} month{months !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

export default TrendChart