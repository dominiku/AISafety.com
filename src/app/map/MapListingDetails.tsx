'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import type { MapOrg } from '@/lib/data/map'
import { trackListingClick } from '@/lib/analytics'
import { withUtm } from '@/lib/utm'
import MapResultRow from './MapResultRow'
import styles from './page.module.css'

interface MapListingDetailsProps {
  org: MapOrg
  // The place on the map the org stands in ("Training Town"), if it has one.
  place: string | null
  // Other orgs in the same place, and how many there are in all.
  nearby: MapOrg[]
  placeCount: number
  suggestCorrectionUrl: string
  onSelect: (id: string) => void
  // A phone's sheet: go over to the list, at this org's card.
  onShowInList: () => void
  onSeeAllInPlace: () => void
  onClose: () => void
}

// The selected organization's details, docked over the map (a bottom sheet on
// a phone). This is the one place on the page with the link to the org's
// site: pins and result rows select, they never navigate.
export default function MapListingDetails({
  org,
  place,
  nearby,
  placeCount,
  suggestCorrectionUrl,
  onSelect,
  onShowInList,
  onSeeAllInPlace,
  onClose,
}: MapListingDetailsProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const dragFromRef = useRef<number | null>(null)
  // Which org's link was copied: moving on to another org clears the note.
  const [copiedFor, setCopiedFor] = useState<string | null>(null)
  const copied = copiedFor === org.id
  const categories = org.category
    .split(',')
    .map(c => c.trim())
    .filter(Boolean)

  // Focus follows the selection, so a keyboard or screen reader user lands on
  // what they just opened.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [org.id])

  const copyLink = async () => {
    const url = new URL(window.location.href)
    url.searchParams.set('org', org.id)
    try {
      await navigator.clipboard.writeText(url.toString())
      setCopiedFor(org.id)
    } catch {
      // Clipboard blocked (permissions, insecure context): the address bar
      // already holds the same link, so there is nothing more to offer.
      setCopiedFor(null)
    }
  }

  return (
    <section
      aria-label={`${org.title} details`}
      className={`border-plus-fill drop-shadow-dark ${styles['details-card']}`}
    >
      {/* A phone's sheet has a handle here: dragging it down closes the
          sheet, as the close button does. */}
      <div
        className={styles['details-head']}
        onTouchStart={event => {
          dragFromRef.current = event.touches[0].clientY
        }}
        onTouchEnd={event => {
          const from = dragFromRef.current
          dragFromRef.current = null
          if (from !== null && event.changedTouches[0].clientY - from > 48) {
            onClose()
          }
        }}
      >
        <p className={`paragraph-xs-bold ${styles['details-place']}`}>
          <Icon src="/images/icons/map.svg" size={16} />
          {place ? `${place} · ${categories[0]}` : categories[0]}
        </p>
        <button
          type="button"
          className={styles['details-close']}
          aria-label="Close details"
          onClick={onClose}
        >
          <Icon src="/images/icons/x.svg" size={16} />
        </button>
      </div>

      <div className={styles['details-body']}>
        <div className={styles['details-title']}>
          {org.logo && (
            <Image
              src={org.logo}
              alt=""
              className={styles['details-logo']}
              width={56}
              height={56}
              unoptimized
              onError={e => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          )}
          <div>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className={styles['details-name']}
            >
              {org.title}
            </h2>
            {/* A phone's sheet has no room for the chip above: the place is
                a line under the name. */}
            <p
              className={`paragraph-xs color-teal-300 ${styles['details-place-line']}`}
            >
              {place ? `${place} · ${categories[0]}` : categories[0]}
            </p>
          </div>
        </div>
        <p className={styles['details-description']}>{org.description}</p>

        <ul className={styles['details-chips']}>
          {categories.map(category => (
            <li
              key={category}
              className={`${styles['details-chip']} ${styles['details-chip-category']}`}
            >
              {category}
            </li>
          ))}
          <li className={styles['details-chip']}>
            {org.status === 'Active' ? 'Active' : 'No longer active'}
          </li>
        </ul>

        <div className={styles['details-actions']}>
          {org.link && org.link !== '#' && (
            <a
              href={withUtm(org.link, 'Map')}
              target="_blank"
              rel="noopener noreferrer"
              className="button-primary"
              aria-label={`Visit website of ${org.title} (opens in a new tab)`}
              onClick={() =>
                trackListingClick(
                  'Map',
                  org.title,
                  org.link,
                  org.id,
                  undefined,
                  'cards',
                  categories[0] || undefined
                )
              }
            >
              Visit website
              <Icon src="/images/icons/arrow-up-right.svg" />
            </a>
          )}
          <button
            type="button"
            className={`button-secondary ${styles['details-show-in-list']}`}
            onClick={onShowInList}
          >
            <Icon src="/images/icons/list.svg" size={16} />
            Show in list
          </button>
          <button type="button" className="button-secondary" onClick={copyLink}>
            <Icon src="/images/icons/link.svg" size={16} />
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          {/* Said once it has happened, for those who can't see the label. */}
          <span role="status" className="visually-hidden">
            {copied ? 'Link copied' : ''}
          </span>
        </div>

        {place && nearby.length > 0 && (
          <div className={styles['details-nearby']}>
            <h3 className="paragraph-xs-bold color-teal-400 padding-bottom-8px">
              Nearby in {place}
            </h3>
            <ul>
              {nearby.map(other => (
                <li key={other.id}>
                  <MapResultRow
                    org={other}
                    selected={false}
                    onSelect={() => onSelect(other.id)}
                  />
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={`paragraph-small-bold color-teal-bright-300 underline cursor-pointer ${styles['explorer-clear']}`}
              onClick={onSeeAllInPlace}
            >
              See all {placeCount} in {place} →
            </button>
          </div>
        )}

        {suggestCorrectionUrl !== '#' && (
          <a
            href={suggestCorrectionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="paragraph-small color-teal-300 underline"
          >
            Suggest a correction
          </a>
        )}
      </div>
    </section>
  )
}
