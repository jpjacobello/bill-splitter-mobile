import { useState, useEffect, useCallback } from 'react';
import { getIsPro, setIsPro } from '../utils/proStorage';

export function usePro() {
  const [isPro, setIsProState] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIsPro().then((v) => {
      setIsProState(v);
      setLoading(false);
    });
  }, []);

  const activatePro = useCallback(async () => {
    // TODO: Replace with RevenueCat / StoreKit purchase flow before charging users.
    await setIsPro(true);
    setIsProState(true);
  }, []);

  const deactivatePro = useCallback(async () => {
    await setIsPro(false);
    setIsProState(false);
  }, []);

  return { isPro, loading, activatePro, deactivatePro };
}
