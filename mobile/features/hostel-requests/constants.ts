export const HOSTEL_REQUEST_FEE = 100;

export const BUDGET_OPTIONS = [
  { value: 'below_3000', label: 'Below KSh 3,000' },
  { value: '3000_5000', label: 'KSh 3,000 to 5,000' },
  { value: '5000_7000', label: 'KSh 5,000 to 7,000' },
  { value: '7000_10000', label: 'KSh 7,000 to 10,000' },
  { value: 'above_10000', label: 'Above KSh 10,000' },
  { value: 'any_amount', label: 'Any amount' },
] as const;

export const GENDER_OPTIONS = [
  { value: 'no_preference', label: 'No preference' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
] as const;

export const ROOM_TYPE_OPTIONS = [
  { value: 'single', label: 'Single room' },
  { value: 'bedsitter', label: 'Bedsitter' },
  { value: 'one_bedroom', label: 'One bedroom' },
  { value: 'no_preference', label: 'Any' },
] as const;

export const STAY_PREFERENCE_OPTIONS = [
  { value: 'alone', label: 'Alone' },
  { value: 'sharing', label: 'Sharing (cost share)' },
  { value: 'no_preference', label: 'No preference' },
] as const;

export const FURNISHING_OPTIONS = [
  { value: 'furnished', label: 'Furnished' },
  { value: 'unfurnished', label: 'Unfurnished' },
  { value: 'no_preference', label: 'Any' },
] as const;

export function budgetLabel(value: string): string {
  const match = BUDGET_OPTIONS.find((b) => b.value === value);
  return match ? match.label : value;
}

export function genderLabel(value: string): string {
  switch (value) {
    case 'male':
      return 'Male';
    case 'female':
      return 'Female';
    default:
      return 'No preference';
  }
}

export function roomTypeLabel(value: string): string {
  switch (value) {
    case 'single':
      return 'Single room';
    case 'shared':
      return 'Shared';
    case 'bedsitter':
      return 'Bedsitter';
    case 'one_bedroom':
      return 'One bedroom';
    default:
      return 'No preference';
  }
}

export function stayPreferenceLabel(value: string): string {
  switch (value) {
    case 'alone':
      return 'Alone';
    case 'sharing':
      return 'Sharing (cost share)';
    default:
      return 'No preference';
  }
}

export function furnishingLabel(value: string): string {
  switch (value) {
    case 'furnished':
      return 'Furnished';
    case 'unfurnished':
      return 'Unfurnished';
    default:
      return 'No preference';
  }
}