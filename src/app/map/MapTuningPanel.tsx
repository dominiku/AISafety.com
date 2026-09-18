'use client'

// PROTOTYPE: live controls for the map's zoom tiers, so the values can be
// judged by eye on the real map. Not meant to ship: once the values are
// settled they become constants in map-zoom-tiers.ts and this file goes.

import { useState, type RefObject } from 'react'
import {
  DEFAULT_ZOOM_TIER_CONFIG,
  type ZoomTierConfig,
} from '@/lib/data/map-zoom-tiers'
import styles from './MapTuningPanel.module.css'

// How the map behaves without the prototype: every pin always showing, and
// pins growing one-to-one with the map.
const TODAY_CONFIG: ZoomTierConfig = {
  ...DEFAULT_ZOOM_TIER_CONFIG,
  overviewBoost: 1,
  growthExponent: 1,
  minPinScale: 0,
  maxPinScale: 100,
  mediumZoom: 0,
  smallZoom: 0,
  minPerArea: 0,
  mediumShare: 0,
  avoidOverlaps: false,
}

type SliderKey =
  | 'overviewBoost'
  | 'growthExponent'
  | 'mediumZoom'
  | 'smallZoom'
  | 'minPerArea'
  | 'mediumShare'
  | 'maxShift'

const SLIDERS: {
  key: SliderKey
  label: string
  hint: string
  min: number
  max: number
  step: number
}[] = [
  {
    key: 'overviewBoost',
    label: 'Pin size zoomed out',
    hint: '1 = the size pins are today',
    min: 0.6,
    max: 3,
    step: 0.1,
  },
  {
    key: 'growthExponent',
    label: 'Pin growth when zooming',
    hint: '0 = constant size, 1 = grows with the map (today)',
    min: 0,
    max: 1,
    step: 0.05,
  },
  {
    key: 'mediumZoom',
    label: 'Medium orgs appear at zoom',
    hint: '',
    min: 0,
    max: 6,
    step: 0.1,
  },
  {
    key: 'smallZoom',
    label: 'Small orgs appear at zoom',
    hint: '',
    min: 0,
    max: 8,
    step: 0.1,
  },
  {
    key: 'minPerArea',
    label: 'Minimum pins per area',
    hint: 'topped up from Medium, then Small',
    min: 0,
    max: 6,
    step: 1,
  },
  {
    key: 'mediumShare',
    label: 'Share of each area showing at the Medium zoom',
    hint: 'topped up from Small orgs; 0 = size tiers only',
    min: 0,
    max: 1,
    step: 0.05,
  },
  {
    key: 'maxShift',
    label: 'How far a pin may slide',
    hint: 'map pixels; a grid square is 41. 0 = never move, only hold back',
    min: 0,
    max: 160,
    step: 5,
  },
]

interface MapTuningPanelProps {
  className: string
  config: ZoomTierConfig
  onChange: (config: ZoomTierConfig) => void
  showAreaCounts: boolean
  onShowAreaCounts: (show: boolean) => void
  /** The map writes the current zoom, pin count and overlaps in here. */
  readoutRef: RefObject<HTMLParagraphElement | null>
}

export default function MapTuningPanel({
  className,
  config,
  onChange,
  showAreaCounts,
  onShowAreaCounts,
  readoutRef,
}: MapTuningPanelProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`${className} ${styles.panel}`}>
      <div className="flex justify-end">
        <button
          type="button"
          className="button-primary"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? 'Hide zoom prototype' : 'Zoom prototype'}
        </button>
      </div>

      {/* Kept mounted while closed so the map can always write the readout. */}
      <div
        className={`${styles.body} flex flex-col gap-12px margin-top-8px padding-top-16px padding-bottom-16px padding-left-16px padding-right-16px`}
        hidden={!open}
      >
        <p ref={readoutRef} className="paragraph-xs color-white" />

        {SLIDERS.map(({ key, label, hint, min, max, step }) => (
          <label key={key} className="flex flex-col gap-4px">
            <span className="paragraph-xs color-white">
              {label}: <strong>{config[key]}</strong>
            </span>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={config[key]}
              onChange={e =>
                onChange({ ...config, [key]: Number(e.target.value) })
              }
            />
            {hint && (
              <span className="paragraph-xs color-teal-300">{hint}</span>
            )}
          </label>
        ))}

        <label className="flex items-center gap-8px paragraph-xs color-white">
          <input
            type="checkbox"
            className="checkbox"
            checked={config.avoidOverlaps}
            onChange={e =>
              onChange({ ...config, avoidOverlaps: e.target.checked })
            }
          />
          Keep pins from overlapping (slide, then hold back)
        </label>

        <label className="flex items-center gap-8px paragraph-xs color-white">
          <input
            type="checkbox"
            className="checkbox"
            checked={showAreaCounts}
            onChange={e => onShowAreaCounts(e.target.checked)}
          />
          Show org counts on area labels
        </label>

        <div className="flex gap-8px">
          <button
            type="button"
            className="button-secondary"
            onClick={() => onChange(DEFAULT_ZOOM_TIER_CONFIG)}
          >
            Prototype
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={() => onChange(TODAY_CONFIG)}
          >
            Today&rsquo;s map
          </button>
        </div>

        <p className={`${styles.settings} paragraph-xs color-teal-300`}>
          {JSON.stringify(config)}
        </p>
      </div>
    </div>
  )
}
