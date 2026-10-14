import { useCallback, useEffect, useState } from 'react';
import api, { errMsg } from './api';

/** Tiny data hook: const { data, loading, error, reload } = useFetch('/rfqs') */
export default function useFetch(path, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      const res = await api.get(path);
      setData(res.data);
      setError('');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => { reload(); }, [reload]);
  return { data, setData, loading, error, reload };
}
