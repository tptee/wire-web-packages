/*
 * Wire
 * Copyright (C) 2018 Wire Swiss GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 *
 */

interface Options {
  feedUrl?: string;
}

interface TravisComponent {
  components?: string[];
  created_at: string;
  description: string | null;
  group_id: string | null;
  id: string;
  name: string;
  page_id: string;
  position: number;
  showcase: boolean;
  status: string;
  updated_at: string;
}

interface TravisAffectedComponent {
  code: string;
  name: string;
  new_status: string;
  old_status: string;
}

interface TravisIncidentUpdate {
  affected_components: TravisAffectedComponent[];
  body: string;
  custom_tweet: string | null;
  deliver_notifications: boolean;
  display_at: string;
  id: string;
  incident_id: string;
  status: string;
  tweet_id: number;
  twitter_updated_at: string;
  updated_at: string;
  wants_twitter_update: boolean;
}

interface TravisIncident {
  created_at: string;
  id: string;
  impact_override: string | null;
  impact: string;
  incident_updates: TravisIncidentUpdate[];
  metadata: {};
  monitoring_at: string | null;
  name: string;
  page_id: string;
  postmortem_body_last_updated_at: string | null;
  postmortem_body: string | null;
  postmortem_ignored: boolean;
  postmortem_notified_subscribers: boolean;
  postmortem_notified_twitter: boolean;
  postmortem_published_at: string | null;
  resolved_at: string | null;
  scheduled_auto_completed: boolean;
  scheduled_auto_in_progress: boolean;
  scheduled_for: string | null;
  scheduled_remind_prior: boolean;
  scheduled_reminded_at: string | null;
  scheduled_until: string | null;
  shortlink: string;
  status: string;
  updated_at: string;
}

interface TravisStatus {
  components: TravisComponent[];
  incidents: TravisIncident[];
  page: {
    id: string;
    name: string;
    url: string;
  };
  status: {
    indicator: string;
    description: string;
  };
}

export {Options, TravisStatus};
