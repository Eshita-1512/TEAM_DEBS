export interface PolicyLookupUser {
  id: string;
  name: string;
  role: string;
  department: string;
  title: string;
}

export const exampleRoles = [
  { id: 'manager', label: 'Manager' },
  { id: 'finance', label: 'Finance' },
  { id: 'director', label: 'Director' },
  { id: 'cfo', label: 'CFO' },
];

export const exampleDepartments = [
  'Operations',
  'Finance',
  'Sales',
  'People',
  'Engineering',
];

export const exampleUsers: PolicyLookupUser[] = [
  {
    id: 'user_finance_1',
    name: 'Priya Nair',
    role: 'finance',
    department: 'Finance',
    title: 'Finance Controller',
  },
  {
    id: 'user_director_1',
    name: 'Marcus Reed',
    role: 'director',
    department: 'Operations',
    title: 'Operations Director',
  },
  {
    id: 'user_cfo_1',
    name: 'Elena Park',
    role: 'cfo',
    department: 'Finance',
    title: 'Chief Financial Officer',
  },
  {
    id: 'user_manager_1',
    name: 'Aarav Shah',
    role: 'manager',
    department: 'Sales',
    title: 'Sales Manager',
  },
];
