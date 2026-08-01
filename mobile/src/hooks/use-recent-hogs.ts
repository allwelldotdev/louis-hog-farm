import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'

import { RECENT_HOGS_KEY, parseRecent, pushRecent } from '@/lib/recent-hogs'

/** The device's recently-used ear tags, backed by AsyncStorage. */
export function useRecentHogs() {
  const [ids, setIds] = useState<number[]>([])

  useEffect(() => {
    AsyncStorage.getItem(RECENT_HOGS_KEY)
      .then((raw) => setIds(parseRecent(raw)))
      .catch(() => {})
  }, [])

  const remember = useCallback((id: number) => {
    setIds((current) => {
      const next = pushRecent(current, id)
      // Fire and forget: losing this costs one extra tap next time, which is
      // not worth making a capture wait on a disk write.
      AsyncStorage.setItem(RECENT_HOGS_KEY, JSON.stringify(next)).catch(() => {})
      return next
    })
  }, [])

  return { recentIds: ids, remember }
}
