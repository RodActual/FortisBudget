/**
 * Date Utilities for FortisBudget
 * 
 * Centralizes all date handling logic to ensure consistency across the app.
 * All dates are stored as Unix timestamps (milliseconds since epoch).
 * All comparisons normalize to midnight in local timezone.
 */

/**
 * Get the start of day (midnight) for a given date in local timezone
 * @param date - Date object, timestamp, or date string
 * @returns Date object set to midnight (00:00:00.000)
 */
export const getStartOfDay = (date: Date | number | string): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Get the current date at midnight (start of today)
 * @returns Date object for today at 00:00:00.000
 */
export const getTodayStart = (): Date => {
  return getStartOfDay(new Date());
};

/**
 * Get timestamp for start of day (midnight) from any date input
 * @param date - Date object, timestamp, or date string
 * @returns Unix timestamp (milliseconds)
 */
export const getStartOfDayTimestamp = (date: Date | number | string): number => {
  return getStartOfDay(date).getTime();
};

/**
 * Check if a date is in the current month and year
 * @param date - Date object, timestamp, or date string
 * @returns true if date is in current month
 */
export const isCurrentMonth = (date: Date | number | string): boolean => {
  const d = new Date(date);
  const now = new Date();
  return d.getMonth() === now.getMonth() && 
         d.getFullYear() === now.getFullYear();
};

/**
 * Check if two dates are the same day (ignoring time)
 * @param date1 - First date
 * @param date2 - Second date  
 * @returns true if both dates are on the same day
 */
export const isSameDay = (
  date1: Date | number | string, 
  date2: Date | number | string
): boolean => {
  const d1 = getStartOfDay(date1);
  const d2 = getStartOfDay(date2);
  return d1.getTime() === d2.getTime();
};

/**
 * Check if date1 is before date2 (comparing days only, ignoring time)
 * @param date1 - First date
 * @param date2 - Second date
 * @returns true if date1 is before date2
 */
export const isDateBefore = (
  date1: Date | number | string,
  date2: Date | number | string
): boolean => {
  const d1 = getStartOfDay(date1);
  const d2 = getStartOfDay(date2);
  return d1.getTime() < d2.getTime();
};

/**
 * Check if date1 is after date2 (comparing days only, ignoring time)
 * @param date1 - First date
 * @param date2 - Second date
 * @returns true if date1 is after date2
 */
export const isDateAfter = (
  date1: Date | number | string,
  date2: Date | number | string
): boolean => {
  const d1 = getStartOfDay(date1);
  const d2 = getStartOfDay(date2);
  return d1.getTime() > d2.getTime();
};

/**
 * Get date N days ago from today at midnight
 * @param days - Number of days ago
 * @returns Date object
 */
export const getDaysAgo = (days: number): Date => {
  const date = getTodayStart();
  date.setDate(date.getDate() - days);
  return date;
};

/**
 * Get timestamp for N days ago at midnight
 * @param days - Number of days ago
 * @returns Unix timestamp (milliseconds)
 */
export const getDaysAgoTimestamp = (days: number): number => {
  return getDaysAgo(days).getTime();
};

/**
 * Check if a date is older than N days
 * @param date - Date to check
 * @param days - Number of days threshold
 * @returns true if date is older than N days
 */
export const isOlderThan = (date: Date | number | string, days: number): boolean => {
  const d = getStartOfDay(date);
  const threshold = getDaysAgo(days);
  return d.getTime() < threshold.getTime();
};

/**
 * Get the month and year from a date
 * @param date - Date to extract from
 * @returns Object with month (0-11) and year
 */
export const getMonthAndYear = (date: Date | number | string): { month: number; year: number } => {
  const d = new Date(date);
  return {
    month: d.getMonth(),
    year: d.getFullYear(),
  };
};

/**
 * Check if two dates are in the same month and year
 * @param date1 - First date
 * @param date2 - Second date
 * @returns true if both dates are in the same month
 */
export const isSameMonth = (
  date1: Date | number | string,
  date2: Date | number | string
): boolean => {
  const d1 = getMonthAndYear(date1);
  const d2 = getMonthAndYear(date2);
  return d1.month === d2.month && d1.year === d2.year;
};

/**
 * Format a date for display (locale-aware)
 * @param date - Date to format
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export const formatDate = (
  date: Date | number | string,
  options?: Intl.DateTimeFormatOptions
): string => {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, options);
};

/**
 * Format a date for form input (YYYY-MM-DD)
 * @param date - Date to format
 * @returns Date string in YYYY-MM-DD format
 */
export const formatDateForInput = (date: Date | number | string): string => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parse a date input string (YYYY-MM-DD) to timestamp at midnight
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Unix timestamp at midnight local time
 */
export const parseDateInput = (dateString: string): number => {
  // Parse as local date, not UTC
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  return date.getTime();
};

/**
 * Get start of current month
 * @returns Date object for first day of current month at midnight
 */
export const getStartOfCurrentMonth = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
};

/**
 * Get start of current month as timestamp
 * @returns Unix timestamp
 */
export const getStartOfCurrentMonthTimestamp = (): number => {
  return getStartOfCurrentMonth().getTime();
};

/**
 * Calculate the next due date based on frequency
 * @param currentDueDate - Timestamp of current due date
 * @param frequency - 'weekly', 'monthly', or 'yearly'
 * @returns Unix timestamp of next due date
 */
export const calculateNextDueDate = (
  currentDueDate: number,
  frequency: "weekly" | "monthly" | "yearly"
): number => {
  const date = new Date(currentDueDate);
  
  if (frequency === "weekly") {
    date.setDate(date.getDate() + 7);
  } else if (frequency === "monthly") {
    date.setMonth(date.getMonth() + 1);
  } else if (frequency === "yearly") {
    date.setFullYear(date.getFullYear() + 1);
  }
  
  return date.getTime();
};