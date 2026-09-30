import {createContext, useCallback, useEffect, useMemo, useState} from 'react';
import {useLocation} from 'react-router-dom';

import {useStateWithStorage} from '../../hooks/useStateWithStorage';

// Phone-sized screens: the nav starts collapsed and opens as an overlay.
const SMALL_SCREEN_QUERY = '(max-width: 768px)';

export const useIsSmallScreen = () => {
  const [matches, setMatches] = useState(() => window.matchMedia(SMALL_SCREEN_QUERY).matches);
  useEffect(() => {
    const matcher = window.matchMedia(SMALL_SCREEN_QUERY);
    const onChange = () => setMatches(matcher.matches);
    matcher.addEventListener('change', onChange);
    return () => matcher.removeEventListener('change', onChange);
  }, []);
  return matches;
};

type NavCollapseContextValue = {
  isCollapsed: boolean;
  toggleCollapsed: () => void;
};

export const NavCollapseContext = createContext<NavCollapseContextValue>({
  isCollapsed: false,
  toggleCollapsed: () => {},
});

const STORAGE_KEY = 'dagster-nav-collapsed';

export const NavCollapseProvider = (props: {children: React.ReactNode}) => {
  const [storedCollapsed, setStoredCollapsed] = useStateWithStorage(STORAGE_KEY, (json: any) =>
    typeof json !== 'boolean' ? false : json,
  );

  const isSmallScreen = useIsSmallScreen();
  const [smallScreenOpen, setSmallScreenOpen] = useState(false);
  const location = useLocation();

  // Close the overlay nav after navigating on a small screen.
  useEffect(() => {
    setSmallScreenOpen(false);
  }, [location]);

  const isCollapsed = isSmallScreen ? !smallScreenOpen : storedCollapsed;

  const toggleCollapsed = useCallback(() => {
    if (isSmallScreen) {
      setSmallScreenOpen((prev) => !prev);
    } else {
      setStoredCollapsed((prev) => !prev);
    }
  }, [isSmallScreen, setStoredCollapsed]);

  const value = useMemo(() => ({isCollapsed, toggleCollapsed}), [isCollapsed, toggleCollapsed]);

  return <NavCollapseContext.Provider value={value}>{props.children}</NavCollapseContext.Provider>;
};
