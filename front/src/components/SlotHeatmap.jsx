import { DAY_LABELS, DAY_SHORT, PENALTY_META, SLOT_TIMES } from '../data/staticData.js'
import { fa } from '../lib/format.js'

function faTime(value) {
  return String(value).replace(/\d/g, (digit) => fa(Number(digit)))
}

export default function SlotHeatmap({ slots, compact = false, showLegend = true }) {
  const slotMap = new Map(slots.map((slot) => [`${slot.day}|${slot.start}`, slot]))

  return (
    <div className={`heatmap ${compact ? 'heatmap--compact' : ''}`}>
      <div className="heatmap__scroll">
        <div className="heatmap__grid">
          <div className="heatmap__corner">ساعت</div>
          {DAY_LABELS.map((day, index) => (
            <div className="heatmap__day" key={day} title={day}>
              <span className="heatmap__day-short">{DAY_SHORT[index]}</span>
              <span className="heatmap__day-full">{day}</span>
            </div>
          ))}

          {SLOT_TIMES.map((time) => (
            <div className="heatmap__row" key={time} style={{ display: 'contents' }}>
              <div className="heatmap__time">
                <strong>{faTime(time)}</strong>
                {!compact && <span>{faTime(`${String(Number(time.slice(0, 2)) + 1).padStart(2, '0')}:00`)}</span>}
              </div>
              {DAY_LABELS.map((_, day) => {
                const slot = slotMap.get(`${day}|${time}`)
                const penalty = slot?.penalty ?? 0
                const meta = PENALTY_META[penalty] || PENALTY_META[0]
                return (
                  <div
                    key={`${day}|${time}`}
                    className={`heatmap__cell heatmap__cell--p${penalty}`}
                    title={`${DAY_LABELS[day]} · ${time} تا ${slot?.end || ''} · ${meta.label} (${fa(penalty)})`}
                  >
                    <span className="heatmap__penalty">{fa(penalty)}</span>
                    {!compact && <span className="heatmap__cell-time">{faTime(time)}</span>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {showLegend && (
        <div className="heatmap__legend">
          {Object.entries(PENALTY_META).map(([penalty, meta]) => (
            <span className="heatmap__legend-item" key={penalty}>
              <i className={`heatmap__swatch heatmap__swatch--p${penalty}`} />
              {meta.label}
              <b>{fa(Number(penalty))}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
