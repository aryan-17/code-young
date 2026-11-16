/**
 * Strategy pattern — mentor assignment (DESIGN.md §5.2).
 * Open/Closed: new strategies implement this interface without modifying BookingService.
 */
export interface EligibleMentor {
  id: number;
  name: string;
  email: string;
  timezone: string;
  bio: string;
  bookingsOnDay: number;
  bookingsInWindow: number;
}

export interface AssignmentContext {
  startUtc: string;
  mentorLocalDate: string;
}

export interface AssignmentStrategy {
  pick(candidates: EligibleMentor[], context: AssignmentContext): EligibleMentor;
}
