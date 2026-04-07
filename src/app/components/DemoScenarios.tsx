'use client';

interface DemoScenariosProps {
  onSelectScenario: (message: string) => void;
}

const SCENARIOS = [
  {
    label: 'Happy Path: Find Flights',
    message: 'Find cheap flights from London to Paris tomorrow',
    description: 'Basic flight search with price priority',
  },
  {
    label: 'Constraint Violation: Budget',
    message: 'Find a flight to Tokyo for $50',
    description: 'Demonstrates constraint violation handling',
  },
  {
    label: 'Multi-Step: Book Flight',
    message:
      'Book flight BA123 for John Doe, born 1990-05-15, email john@example.com',
    description: 'Shows booking with passenger details',
  },
  {
    label: 'Calendar Check',
    message: "Check if I'm free next week for travel to New York",
    description: 'Uses calendar check tool',
  },
  {
    label: 'Complex Query',
    message:
      'I need to fly to Barcelona next month, preferably business class, with a return trip. What are my options?',
    description: 'Multiple requirements extraction',
  },
  {
    label: 'Ambiguous Intent',
    message: 'I want to go somewhere warm',
    description: 'Low confidence intent detection',
  },
];

export function DemoScenarios({ onSelectScenario }: DemoScenariosProps) {
  return (
    <div className="mb-4">
      <details className="bg-white rounded-lg shadow border border-gray-200">
        <summary className="px-4 py-3 cursor-pointer hover:bg-gray-50 font-medium text-gray-700">
          🎯 Quick Demo Scenarios
        </summary>
        <div className="p-4 space-y-2 border-t border-gray-200">
          {SCENARIOS.map((scenario, idx) => (
            <button
              key={idx}
              onClick={() => onSelectScenario(scenario.message)}
              className="w-full text-left p-3 rounded-lg hover:bg-blue-50 border border-gray-200 hover:border-blue-300 transition-colors"
            >
              <div className="font-medium text-sm text-gray-900">
                {scenario.label}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {scenario.description}
              </div>
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
