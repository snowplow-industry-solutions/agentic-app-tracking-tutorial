// Shared TypeScript types

export interface Flight {
  id: string;
  airline: string;
  flight_number: string;
  departure: {
    airport: string;
    time: string;
    terminal?: string;
  };
  arrival: {
    airport: string;
    time: string;
    terminal?: string;
  };
  duration_minutes: number;
  stops: number;
  price: {
    amount: number;
    currency: string;
  };
  cabin_class: string;
  seats_available: number;
}

export interface FlightSearchParams {
  origin: string;
  destination: string;
  date: string;
  return_date?: string;
  passengers?: number;
  cabin_class?: 'economy' | 'premium_economy' | 'business' | 'first';
  sort_by?: 'price' | 'duration' | 'departure_time' | 'arrival_time';
  max_results?: number;
}

export interface FlightSearchResult {
  flights: Flight[];
  search_metadata: {
    searched_at: string;
    total_results: number;
    search_duration_ms: number;
  };
}

export interface Booking {
  confirmation_code: string;
  booking_id: string;
  status: 'confirmed' | 'pending' | 'failed';
  flight_details: Flight;
  passenger_details: PassengerDetails;
  total_price: {
    amount: number;
    currency: string;
  };
  booked_at: string;
}

export interface PassengerDetails {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  date_of_birth: string;
}

export interface CalendarConflict {
  date: string;
  time: string;
  title: string;
  conflict_severity: 'high' | 'medium' | 'low';
}

export interface CalendarCheckResult {
  conflicts: CalendarConflict[];
  available_dates: string[];
  checked_at: string;
}
