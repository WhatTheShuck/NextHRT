import { ExpiringTicketRecordsPage } from "./expiring-tickets-report";

// Server component that fetches initial data
export default async function CompletedTrainingPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Expiring Ticket Records</h1>

      <ExpiringTicketRecordsPage />
    </div>
  );
}
