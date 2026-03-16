import { ExpiringTicketRecordsPage } from "./expiring-tickets-report";

export default async function CompletedTrainingPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8">
      <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Expiring Ticket Records</h1>

      <ExpiringTicketRecordsPage />
    </div>
  );
}
