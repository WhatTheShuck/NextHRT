export default function TrainingRequest() {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1>Sorry, this is not implemented in HRT just yet</h1>
      <p>
        You can continue to request training at{" "}
        <a
          href={process.env.NEXT_PUBLIC_TRAINING_REQUEST_URL}
          className="text-blue-600 hover:underline hover:text-blue-800"
        >
          {process.env.NEXT_PUBLIC_TRAINING_REQUEST_URL}
        </a>
      </p>
    </div>
  );
}
