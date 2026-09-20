'use client'

import Image from 'next/image'
import Icon from '@/components/Icon'
import type { MapOrg } from '@/lib/data/map'
import styles from './page.module.css'

interface MapResultRowProps {
  org: Pick<MapOrg, 'id' | 'title' | 'category' | 'mapLogo'>
  selected: boolean
  // In the results drawer the row is an option of the drawer's listbox: the
  // listbox handles its clicks and keys, and marks the row the arrow keys are
  // on. Elsewhere ("Nearby" in the details card) the row is a button.
  onSelect?: () => void
  active?: boolean
}

// One organization in the map's results drawer. The whole row selects the
// org: its details, and the link to its site, are in the details card, so
// there is no link inside the row.
export default function MapResultRow({
  org,
  selected,
  onSelect,
  active = false,
}: MapResultRowProps) {
  // The first category places the org on the map; the rest are a count, so
  // the line is never cut mid-word.
  const categories = org.category
    .split(',')
    .map(c => c.trim())
    .filter(Boolean)
  const className = `${styles['result-row']}${selected ? ` ${styles['result-row-selected']}` : ''}${active ? ` ${styles['result-row-active']}` : ''}`
  const content = (
    <>
      <span className={styles['result-row-logo']}>
        {org.mapLogo && (
          <Image
            src={org.mapLogo}
            alt=""
            width={40}
            height={40}
            unoptimized
            onError={e => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        )}
      </span>
      <span className={styles['result-row-text']}>
        <span className={styles['result-row-name']}>{org.title}</span>
        <span className={styles['result-row-category']}>
          {categories[0]}
          {categories.length > 1 && (
            <>
              {' '}
              <span aria-hidden="true">+{categories.length - 1}</span>
              <span className="visually-hidden">
                and {categories.length - 1} more
              </span>
            </>
          )}
        </span>
      </span>
      <Icon
        src="/images/icons/chevron-down.svg"
        size={16}
        className={`color-teal-300 ${styles['result-row-chevron']}`}
      />
    </>
  )
  return onSelect ? (
    <button
      type="button"
      className={className}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  )
}
