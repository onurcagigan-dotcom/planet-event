
import { Task } from './types';

export const EVENT_DATE = '2026-02-17';

export const DEFAULT_CATEGORIES = [
  'PREPARATIONS',
  'LOGISTICS & TRANSPORT',
  'CATERING & FOOD',
  'VENUE SETUP & HR',
  'PRINTED / PRODUCED MATERIALS',
  'DIGITAL CONTENTS',
  'APPROVALS'
];

const generateInitialTasks = (): Task[] => {
  const rawData = [
    { cat: 'PREPARATIONS', items: [
      { t: 'Project Logo', n: '' },
      { t: 'Project Web site', n: 'Domain name, design, emails' },
      { t: 'Project Short name', n: '' },
      { t: 'Determination of the Event Location', n: '' },
      { t: 'Concept note', n: '' },
      { t: 'The speakers', n: 'Confirmation of speakers' },
      { t: 'List of invitees', n: 'Critical for RSVP process' },
      { t: 'Programme finalisation', n: 'Finalizing the event flow' },
      { t: 'Invitation (Design)', n: 'Design approval' },
      { t: 'Sending Save the Date', n: 'Digital distribution' },
      { t: 'Sending electronic invitations', n: 'Main invitation distribution' },
      { t: 'RSVP / LCV', n: 'Final headcount deadline' },
      { t: 'Accommodation', n: 'Guest hotel bookings' }
    ]},
    { cat: 'LOGISTICS & TRANSPORT', items: [
      { t: 'VIP Transfers', n: 'Arrangement of cars & driver contact lists' }
    ]},
    { cat: 'CATERING & FOOD', items: [
      { t: 'Menu Selection & Tasting', n: 'Tasting & Final approval (inc. Dietary/Allergens)' },
      { t: 'Beverage Plan', n: 'Coffee breaks menu' },
      { t: 'Staff Catering', n: 'Meal plan for technical staff & hostesses' },
      { t: 'Service Layout', n: 'Approval of bistro tables & service area layout' }
    ]},
    { cat: 'VENUE SETUP & HR', items: [
      { t: 'Hostess & Team', n: 'Team selection' },
      { t: 'Uniform & Styling', n: 'Dress code determination' },
      { t: 'Registration Desk', n: 'Setup & material check' },
      { t: 'Cloakroom (Vestiyer)', n: 'Hangers, numbers & staff arrangement' },
      { t: 'Decoration', n: 'Decor installation' },
      { t: 'Flag sets / Roll up', n: 'Production delivery' },
      { t: 'Banners', n: 'inside, outside' },
      { t: 'Wayfinding', n: 'Screen or printed design' },
      { t: 'Swallow tail flag', n: 'Production delivery' }
    ]},
    { cat: 'PRINTED / PRODUCED MATERIALS', items: [
      { t: 'Invitation (Print)', n: 'Delivery of printed cards' },
      { t: 'Speech cards', n: 'Text approval & printing' },
      { t: 'Folder for press', n: 'Press kit preparation' },
      { t: 'Pre-event Press bulletin', n: 'Distribution to media' },
      { t: 'Post-event Press bulletin', n: 'Draft preparation' },
      { t: 'Brochure', n: 'Print delivery' },
      { t: 'Stickers for Protocol seats', n: 'Print delivery' },
      { t: 'Signature list', n: 'Guest list printout for entrance' },
      { t: 'Promotion Set', n: 'Gift bags preparation' },
      { t: 'Printer, Paper, Ink', n: 'Backup office supplies for desk' },
      { t: 'Gifts / Plaques', n: 'Purchase / Production for speakers' }
    ]},
    { cat: 'DIGITAL CONTENTS', items: [
      { t: 'Project Video', n: 'Final edit delivery' },
      { t: 'Social media posts (pre-event)', n: 'Start of sharing schedule' },
      { t: 'Social media posts (during event)', n: 'Live coverage plan' },
      { t: 'Social media posts (post-event)', n: 'Wrap-up video/photos' },
      { t: 'LED screen', n: 'Content formatting & delivery' },
      { t: 'Music / Playlist', n: 'Playlist approval (Background music)' },
      { t: 'Photo / Video shooting', n: 'Crew booking' },
      { t: 'WiFi Setup', n: 'Password' }
    ]},
    { cat: 'APPROVALS', items: [
      { t: 'Incidental approval', n: 'Budget approvals for extras' },
      { t: 'Beneficiary- Visibility Approvals', n: 'Logo & Visibility usage approvals' }
    ]}
  ];

  const tasks: Task[] = [];
  rawData.forEach((group, gIdx) => {
    group.items.forEach((item, iIdx) => {
      tasks.push({
        id: `${gIdx}-${iIdx}`,
        category: group.cat,
        title: item.t,
        status: 'Pending',
        notes: item.n,
        deadline: null,
        assignee: null,
        updatedAt: Date.now()
      });
    });
  });
  return tasks;
};

export const INITIAL_TASKS: Task[] = generateInitialTasks();

export const STATUS_COLORS: Record<string, string> = {
  'Pending': 'bg-gray-100 text-gray-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  'Completed': 'bg-green-100 text-green-700',
  'Cancelled': 'bg-red-100 text-red-700',
};
