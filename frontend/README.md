# TeamFlow frontend

A small React + TypeScript UI for the Smart Appointment project. Screens load and update data through the backend API; sign in with a backend account to use protected features.

## Run locally

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The development server prints the local URL to open in your browser. The API client uses `http://localhost:3000/api` by default. Change `VITE_API_URL` in `.env` if the backend uses another address.

Start the backend separately from the `backend/` folder and make sure its MongoDB connection is available. Register creates a customer account; staff and admin accounts must be created through the backend's supported flow.

## Folder guide

- `src/components/` has reusable UI components. Names and responsibilities follow page 20 of the PDF, and each component has its own CSS file:
  - `AP_Button` handles variants, sizes, loading, and disabled states.
  - `AP_Textbox` and `AP_Select` keep labels and validation messages with their fields.
  - `AP_DatePicker` supports a minimum date and unavailable weekdays.
  - `AP_Modal` displays a title, message, and actions.
  - `AP_Table` takes columns and rows, and provides sorting and pagination.
  - `AP_StatusPill` shows appointment and queue statuses with text as well as color.
  - `AP_Loading`, `AP_Empty`, `AP_Error`, and `AP_Success` are the four reusable data states.
- `AP_PageHeader`, `AP_StatCard`, `AP_BarChart`, and `AP_Sidebar` are page layout components.
- `src/screen/` has one file for each page.
- Each screen imports a matching CSS file, for example `Dashboard.tsx` and `Dashboard.css`.
- `src/shared/` has API methods, shared types, and Yup validation.
- `src/interceptors/` adds the saved login token to Axios requests and handles expired sessions.

The sign-in and customer registration forms share one responsive authentication page and use the backend auth endpoints. Successful authentication stores the backend-issued token for protected API requests. Dashboard, appointment, queue, service, staff, and booking screens use live API data and display loading, empty, error, or success states as appropriate.

For details on the authenticated Socket.IO connection, event audiences, booking toast, and how screens refresh after realtime events, see the [Socket.IO and Real-Time Notifications Guide](../SOCKET-IO-REALTIME-GUIDE.md).

## Employee roles

- Admins can create, deactivate, and reactivate staff or receptionist accounts from the Staff page. Deactivation preserves appointment history and schedules while preventing sign-in. Deactivating Staff cancels their future active appointments and emails affected customers a red rescheduling button. Admins can permanently delete a deactivated Staff account; appointment history is retained with the former staff member's name.
- Receptionists land on Appointments and also have a Queue page with date-filtered appointments and today's live queue. They can see queue numbers, check-in times, and waiting durations, but cannot call or complete queue entries. Pending appointments must be confirmed first; successful check-in shows the returned queue number. Receptionists cannot access Dashboard, reschedule, or cancel appointments.
- Staff land on Appointments and Queue. The backend scopes their appointment list to their assigned bookings; queue actions are available to Staff. Admins and Staff can reschedule eligible appointments from the row actions; Receptionists do not see actions the backend does not allow.
- Admins can access Dashboard, Appointments, Queue, Services, and Staff. Receptionists are created by admins; public registration continues to create Customer accounts only.

The Admin-only employee list displays Staff and Receptionist accounts, including deactivated accounts. Only active Staff accounts have an editable schedule.
