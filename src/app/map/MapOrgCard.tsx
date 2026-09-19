'use client'

import Image from 'next/image'
import type { MapOrg } from '@/lib/data/map'
import { trackListingClick } from '@/lib/analytics'
import { withUtm } from '@/lib/utm'
import styles from './page.module.css'

interface MapOrgCardProps {
  org: Pick<
    MapOrg,
    'id' | 'title' | 'description' | 'category' | 'logo' | 'link'
  >
  /** The card's slot on the page ('1', '2'…) at click time. */
  placement?: string
  /** The explorer column's cards. When given, clicking the card selects the
   *  org (shown on the map) instead of opening its site, and only the title
   *  is the link to the site — so there is no link inside a link. */
  onSelect?: () => void
  selected?: boolean
}

// The card in the list beside (or under) the field map: hand-written rather
// than ListingCard because it shows a labelled Category row. The admin Queue's
// "how it will look on the site" preview renders this same component.
export default function MapOrgCard({
  org,
  placement,
  onSelect,
  selected = false,
}: MapOrgCardProps) {
  const href = withUtm(org.link, 'Map')
  const trackClick = () =>
    trackListingClick(
      'Map',
      org.title,
      org.link,
      org.id,
      placement,
      'cards',
      // First category = the org's map area; the dashboard groups
      // Map-page activity by it.
      org.category.split(',')[0].trim() || undefined
    )

  const body = (title: React.ReactNode) => (
    <>
      <div className="flex items-center gap-16px padding-bottom-24px">
        <div className="featured-img">
          {org.logo && (
            <Image
              src={org.logo}
              alt=""
              className="card-image"
              width={64}
              height={64}
              unoptimized
              onError={e => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          )}
        </div>
        <h3>{title}</h3>
      </div>
      <p className="paragraph-small padding-bottom-24px">{org.description}</p>
      <p className="paragraph-xs-bold color-teal-400 padding-bottom-4px">
        Category
      </p>
      <p className="paragraph-small">{org.category}</p>
    </>
  )

  if (onSelect) {
    return (
      <div
        id={org.id}
        className={`card cursor-pointer${selected ? ` ${styles['explorer-card-selected']}` : ''}`}
        aria-current={selected ? 'true' : undefined}
        onClick={onSelect}
      >
        {body(
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            // Opening the site is not also a selection.
            onClick={event => {
              event.stopPropagation()
              trackClick()
            }}
          >
            {org.title}
          </a>
        )}
      </div>
    )
  }

  return (
    <a
      id={org.id}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="card"
      onClick={trackClick}
    >
      {body(org.title)}
    </a>
  )
}
