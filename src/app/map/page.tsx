import MapClient from './MapClient'
import { getMapData } from '@/lib/data/map'
import { fetchLastUpdated } from '@/lib/data/last-updated'
import { hasCredentialSet } from '@/lib/data/public-api'
import { pageMetadata } from '@/lib/page-metadata'
import { SITE_PAGES } from '@/lib/site-pages'

export const metadata = pageMetadata(SITE_PAGES.map)

// IA_work: a separate, forked Airtable base a collaborator uses to prototype
// the map's structure without touching production data. The in-page toggle
// (top center) switches between the two. Optional — an environment without
// AIRTABLE_IA_FORK_TOKEN/BASE_ID (e.g. a fresh contributor clone) just gets
// the normal single-dataset map, no toggle.
const IA_FORK_CREDENTIAL_SET = 'IA_FORK'

export default async function MapPage() {
  const hasIaFork = hasCredentialSet(IA_FORK_CREDENTIAL_SET)

  const [production, iaWork, lastUpdated] = await Promise.all([
    getMapData(),
    hasIaFork ? getMapData({ credentialSet: IA_FORK_CREDENTIAL_SET }) : null,
    fetchLastUpdated('map'),
  ])

  return (
    <MapClient
      production={{
        orgs: production.records,
        suggestEntryLink: production.suggestEntryLink,
        suggestCorrectionLink: production.suggestCorrectionLink,
      }}
      iaWork={
        iaWork && {
          orgs: iaWork.records,
          suggestEntryLink: iaWork.suggestEntryLink,
          suggestCorrectionLink: iaWork.suggestCorrectionLink,
        }
      }
      lastUpdatedIso={lastUpdated.lastUpdated}
    />
  )
}
