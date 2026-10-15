// The layout of the site's pages: the header above whatever page the path shows.
import { createFileRoute } from '@tanstack/react-router';
import { SiteLayout } from '../screens/SiteLayout';

export const Route = createFileRoute('/_site')({ component: SiteLayout });
