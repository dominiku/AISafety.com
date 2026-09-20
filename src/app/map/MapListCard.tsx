'use client'

import Image from 'next/image'
import Icon from '@/components/Icon'
import type { MapOrg } from '@/lib/data/map'
import { trackListingClick } from '@/lib/analytics'
import { withUtm } from '@/lib/utm'
import styles from './page.module.css'

interface MapListCardProps {
  org: Pick<
    MapOrg,
    'id' | 'title' | 'description' | 'category' | 'mapLogo' | 'link'
  >
  selected: boolean
  onSelect: () => void
  onShowOnMap: () => void
}

// One organization in the phone's list. Unlike the desktop drawer's row there
// is no details card beside it, so the card carries the description and the
// org's name is the link to its site. A tap anywhere else selects the card,
// and the selected card offers "Show on map". That button is there for every
// card, seen once the card is selected or the button has the keyboard's focus.
export default function MapListCard({
  org,
  selected,
  onSelect,
  onShowOnMap,
}: MapListCardProps) {
  const hasLink = org.link && org.link !== '#'
  return (
    <div
      id={org.id}
      className={`${styles['list-card']}${selected ? ` ${styles['list-card-selected']}` : ''}`}
      onClick={onSelect}
    >
      <div className={styles['list-card-head']}>
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
        {hasLink ? (
          <a
            href={withUtm(org.link, 'Map')}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline ${styles['list-card-name']}`}
            aria-label={`${org.title} (opens in a new tab)`}
            onClick={event => {
              event.stopPropagation()
              trackListingClick(
                'Map',
                org.title,
                org.link,
                org.id,
                undefined,
                'cards',
                org.category.split(',')[0].trim() || undefined
              )
            }}
          >
            {org.title}
          </a>
        ) : (
          <span className={styles['list-card-name']}>{org.title}</span>
        )}
      </div>
      <p className={styles['list-card-description']}>{org.description}</p>
      <div className={styles['list-card-foot']}>
        <span className={styles['result-row-category']}>{org.category}</span>
        <button
          type="button"
          className={`paragraph-xs-bold ${styles['list-card-show']}`}
          onClick={event => {
            event.stopPropagation()
            onShowOnMap()
          }}
        >
          <Icon src="/images/icons/pin.svg" size={16} />
          Show on map
        </button>
      </div>
    </div>
  )
}
