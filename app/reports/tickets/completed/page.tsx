import { CompletedTicketPage } from "./completed-tickets-report";

// Server component that fetches initial data
export default async function CompletedTrainingPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8">
      <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Ticket Completion Records</h1>

      <CompletedTicketPage />
    </div>
  );
}
