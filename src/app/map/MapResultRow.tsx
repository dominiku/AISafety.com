'use client'

import Image from 'next/image'
import Icon from '@/components/Icon'
import type { MapOrg } from '@/lib/data/map'
import styles from './page.module.css'

interface MapResultRowProps {
  org: Pick<MapOrg, 'id' | 'title' | 'category' | 'mapLogo'>
  selected: boolean
  onSelect: () => void
}

// One organization in the map's results drawer. The whole row is a button
// that selects the org: its details, and the link to its site, are in the
// details card, so there is no link inside the row.
export default function MapResultRow({
  org,
  selected,
  onSelect,
}: MapResultRowProps) {
  return (
    <button
      type="button"
      id={org.id}
      className={`${styles['result-row']}${selected ? ` ${styles['result-row-selected']}` : ''}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
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
        <span className={styles['result-row-category']}>{org.category}</span>
      </span>
      <Icon
        src="/images/icons/chevron-down.svg"
        size={16}
        className={`color-teal-300 ${styles['result-row-chevron']}`}
      />
    </button>
  )
}
