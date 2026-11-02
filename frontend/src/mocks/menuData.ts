/**
 * IIIT Dharwad Mess 1 Menu Data
 *
 * Source: "IIIT DWD MESS MENU - MESS 1.pdf"
 * Transcribed from the official mess committee document.
 *
 * NOTES FROM SOURCE:
 * Note 1: "/" - Slashed items should be provided in alternative weeks
 * Note 2: Limitation Applies Only To Banana, Sweet, Punugulu And Fruits Items,
 *          (Maximum Banana 2 Piece, Ice Cream 1 Cup)
 * Note 3: On Afternoons Egg's are limited to 2
 *
 * VERIFICATION STATUS:
 * - Menu items transcribed directly from PDF extraction.
 * - "***" entries in the source appear to indicate "no item" for that slot.
 * - "****" entries are treated identically to "***".
 * - Slash-separated items indicate alternating weeks per Note 1.
 * - Some items may need verification against the physical menu board.
 */

import { DayOfWeek, MealType, MenuMealEntry, DishItem } from '../types';

let dishCounter = 0;
function dish(name: string, alternatives?: string[], category?: string): DishItem {
  return {
    id: `dish-${++dishCounter}`,
    name,
    alternatives,
    category,
  };
}

/**
 * Source menu notes that apply globally
 */
export const MENU_NOTES = [
  'Slashed items (/) are provided in alternating weeks (Source: Note 1)',
  'Maximum 2 bananas per person (Source: Note 2)',
  'Maximum 1 cup of ice cream per person (Source: Note 2)',
  'Limitations apply to Banana, Sweet, Punugulu, and Fruits items (Source: Note 2)',
  'Afternoon eggs are limited to 2 per person (Source: Note 3)',
];

export const MENU_SOURCE_INFO = {
  documentTitle: 'IIIT MESS 1 MENU',
  source: 'Mess Committee IIIT DWD',
  fileName: 'IIIT DWD MESS MENU - MESS 1.pdf',
  transcriptionNote:
    'Menu items transcribed from the official PDF. Some entries marked "***" in the source indicate no specific item for that slot. Verify against the physical menu board if discrepancies are found.',
};

export const initialMenuData: MenuMealEntry[] = [
  // =============== MONDAY ===============
  {
    id: 'mon-breakfast',
    dayOfWeek: DayOfWeek.MONDAY,
    mealType: MealType.BREAKFAST,
    dishes: [
      dish('Pongal', ['Poha with Sev'], 'main'),
      dish('Chutney', undefined, 'accompaniment'),
      dish('Black Chana Sprouts', undefined, 'side'),
      dish('Boiled Egg', undefined, 'protein'),
    ],
    accompaniments: [
      'Fruits / Cornflakes (alternating weeks)',
      'BBJ - Bread Butter Jam',
      'Tea, Coffee, Milk, Bournvita / Horlicks',
    ],
    notes: ['Pongal / Poha with Sev: alternating weeks (Note 1)'],
  },
  {
    id: 'mon-lunch',
    dayOfWeek: DayOfWeek.MONDAY,
    mealType: MealType.LUNCH,
    dishes: [
      dish('Curd Rice', undefined, 'rice'),
      dish('Dal Methi', undefined, 'dal'),
      dish('Brinjal Bhartha', undefined, 'sabzi'),
      dish('Chapati', ['Fulka'], 'bread'),
      dish('Buttermilk', undefined, 'beverage'),
    ],
    accompaniments: [
      'Plain Rice',
      'Pickle',
      'Papad',
      'Mix Salad',
      'Green Chilli / Lemon Slice',
    ],
    notes: [
      'Chapati / Fulka: alternating weeks (Note 1)',
      'Afternoon eggs limited to 2 (Note 3)',
    ],
  },
  {
    id: 'mon-snacks',
    dayOfWeek: DayOfWeek.MONDAY,
    mealType: MealType.SNACKS,
    dishes: [
      dish('Samosa', undefined, 'snack'),
    ],
    accompaniments: [
      'Red Chutney & Green Chutney',
      'Fruits',
      'BBJ - Bread Butter Jam',
      'Ginger Tea, Milk, Bournvita / Horlicks',
    ],
    notes: ['Fruit limitations apply (Note 2)'],
  },
  {
    id: 'mon-dinner',
    dayOfWeek: DayOfWeek.MONDAY,
    mealType: MealType.DINNER,
    dishes: [
      dish('Kadai Paneer', undefined, 'sabzi'),
      dish('Rasam', undefined, 'soup'),
      dish('Dal Pancharatan', undefined, 'dal'),
      dish('Sheera (Rava)', undefined, 'dessert'),
    ],
    accompaniments: [
      'Plain Rice',
      'Chapati / Fulka',
      'Mix Salad',
      'Pickle',
      'Green Chilli / Lemon Slice',
    ],
    notes: ['Sweet limitation applies to Sheera (Note 2)'],
  },

  // =============== TUESDAY ===============
  {
    id: 'tue-breakfast',
    dayOfWeek: DayOfWeek.TUESDAY,
    mealType: MealType.BREAKFAST,
    dishes: [
      dish('Upma', ['Sewaiya Upma'], 'main'),
      dish('Sheera', undefined, 'sweet'),
      dish('Chutney', undefined, 'accompaniment'),
      dish('Boiled Groundnut', undefined, 'side'),
      dish('Egg Bhurji', undefined, 'protein'),
    ],
    accompaniments: [
      'Fruits / Cornflakes (alternating weeks)',
      'BBJ - Bread Butter Jam',
      'Tea, Coffee, Milk, Bournvita / Horlicks',
    ],
    notes: ['Upma / Sewaiya Upma: alternating weeks (Note 1)'],
  },
  {
    id: 'tue-lunch',
    dayOfWeek: DayOfWeek.TUESDAY,
    mealType: MealType.LUNCH,
    dishes: [
      dish('Veg Pulav', undefined, 'rice'),
      dish('Dal Tadka', undefined, 'dal'),
      dish('White Peas Masala', undefined, 'sabzi'),
      dish('Puri', undefined, 'bread'),
      dish('Lemonade', undefined, 'beverage'),
      dish('Curd', undefined, 'accompaniment'),
    ],
    accompaniments: [
      'Plain Rice',
      'Pickle',
      'Papad',
      'Mix Salad',
      'Green Chilli / Lemon Slice',
    ],
    notes: ['Afternoon eggs limited to 2 (Note 3)'],
  },
  {
    id: 'tue-snacks',
    dayOfWeek: DayOfWeek.TUESDAY,
    mealType: MealType.SNACKS,
    dishes: [
      dish('Pani Puri', undefined, 'snack'),
    ],
    accompaniments: [
      'Fruits',
      'BBJ - Bread Butter Jam',
      'Ginger Tea, Milk, Bournvita / Horlicks',
    ],
    notes: [
      'No Red/Green Chutney on Tuesday (source: "except Tuesday")',
      'Fruit limitations apply (Note 2)',
    ],
  },
  {
    id: 'tue-dinner',
    dayOfWeek: DayOfWeek.TUESDAY,
    mealType: MealType.DINNER,
    dishes: [
      dish('Khichadi', ['Bisibele Bath with Boondi'], 'rice'),
      dish('Bhendi Sabji', undefined, 'sabzi'),
      dish('Veg Kadai', undefined, 'sabzi'),
      dish('Channa Dal', undefined, 'dal'),
      dish('Ice Cream (Variety of Flavours)', undefined, 'dessert'),
    ],
    accompaniments: [
      'Plain Rice',
      'Chapati / Fulka',
      'Mix Salad',
      'Pickle',
      'Green Chilli / Lemon Slice',
    ],
    notes: [
      'Khichadi / Bisibele Bath with Boondi: alternating weeks (Note 1)',
      'Ice Cream: maximum 1 cup (Note 2)',
    ],
  },

  // =============== WEDNESDAY ===============
  {
    id: 'wed-breakfast',
    dayOfWeek: DayOfWeek.WEDNESDAY,
    mealType: MealType.BREAKFAST,
    dishes: [
      dish('Idli', undefined, 'main'),
      dish('Vada', undefined, 'main'),
      dish('Sambar & Chutney', undefined, 'accompaniment'),
      dish('Matki Sprouts', undefined, 'side'),
      dish('Boiled Egg', undefined, 'protein'),
    ],
    accompaniments: [
      'Fruits / Cornflakes (alternating weeks)',
      'BBJ - Bread Butter Jam',
      'Tea, Coffee, Milk, Bournvita / Horlicks',
    ],
    notes: [],
  },
  {
    id: 'wed-lunch',
    dayOfWeek: DayOfWeek.WEDNESDAY,
    mealType: MealType.LUNCH,
    dishes: [
      dish('Onion Rice', undefined, 'rice'),
      dish('Dal Makhani', undefined, 'dal'),
      dish('Jeera Aloo', undefined, 'sabzi'),
      dish('Chawli Masala', undefined, 'sabzi'),
      dish('Chapati', ['Fulka'], 'bread'),
      dish('Jaljeera', undefined, 'beverage'),
      dish('Curd', undefined, 'accompaniment'),
    ],
    accompaniments: [
      'Plain Rice',
      'Pickle',
      'Papad',
      'Mix Salad',
      'Green Chilli / Lemon Slice',
    ],
    notes: [
      'Chapati / Fulka: alternating weeks (Note 1)',
      'Afternoon eggs limited to 2 (Note 3)',
    ],
  },
  {
    id: 'wed-snacks',
    dayOfWeek: DayOfWeek.WEDNESDAY,
    mealType: MealType.SNACKS,
    dishes: [
      dish('Punugulu & Chutney', undefined, 'snack'),
    ],
    accompaniments: [
      'Red Chutney & Green Chutney',
      'Fruits',
      'BBJ - Bread Butter Jam',
      'Ginger Tea, Milk, Bournvita / Horlicks',
    ],
    notes: [
      'Punugulu limitation applies (Note 2)',
      'Fruit limitations apply (Note 2)',
    ],
  },
  {
    id: 'wed-dinner',
    dayOfWeek: DayOfWeek.WEDNESDAY,
    mealType: MealType.DINNER,
    dishes: [
      dish('Soyabean Biryani', undefined, 'rice'),
      dish('Paneer Kholapuri', undefined, 'sabzi'),
      dish('Rasam', undefined, 'soup'),
      dish('Raita', undefined, 'accompaniment'),
      dish('Masoor Dal', undefined, 'dal'),
      dish('Shevai Kheer', undefined, 'dessert'),
    ],
    accompaniments: [
      'Plain Rice',
      'Chapati / Fulka',
      'Mix Salad',
      'Pickle',
      'Green Chilli / Lemon Slice',
    ],
    notes: ['Sweet limitation applies to Shevai Kheer (Note 2)'],
  },

  // =============== THURSDAY ===============
  {
    id: 'thu-breakfast',
    dayOfWeek: DayOfWeek.THURSDAY,
    mealType: MealType.BREAKFAST,
    dishes: [
      dish('Aloo Paratha', undefined, 'main'),
      dish('Chutney & Curd', undefined, 'accompaniment'),
      dish('Boiled Sweet Corn', undefined, 'side'),
      dish('Boiled Egg', undefined, 'protein'),
    ],
    accompaniments: [
      'Fruits / Cornflakes (alternating weeks)',
      'BBJ - Bread Butter Jam',
      'Tea, Coffee, Milk, Bournvita / Horlicks',
    ],
    notes: [],
  },
  {
    id: 'thu-lunch',
    dayOfWeek: DayOfWeek.THURSDAY,
    mealType: MealType.LUNCH,
    dishes: [
      dish('Puliogare', undefined, 'rice'),
      dish('Dal Fry', undefined, 'dal'),
      dish('Brinjal Tomato', undefined, 'sabzi'),
      dish('Kadhi Pakoda', undefined, 'sabzi'),
      dish('Chapati', ['Fulka'], 'bread'),
      dish('Lassi', undefined, 'beverage'),
    ],
    accompaniments: [
      'Plain Rice',
      'Pickle',
      'Papad',
      'Mix Salad',
      'Green Chilli / Lemon Slice',
    ],
    notes: [
      'Chapati / Fulka: alternating weeks (Note 1)',
      'Afternoon eggs limited to 2 (Note 3)',
    ],
  },
  {
    id: 'thu-snacks',
    dayOfWeek: DayOfWeek.THURSDAY,
    mealType: MealType.SNACKS,
    dishes: [
      dish('Veg Noodles', undefined, 'snack'),
    ],
    accompaniments: [
      'Red Chutney & Green Chutney',
      'Fruits',
      'BBJ - Bread Butter Jam',
      'Ginger Tea, Milk, Bournvita / Horlicks',
    ],
    notes: ['Fruit limitations apply (Note 2)'],
  },
  {
    id: 'thu-dinner',
    dayOfWeek: DayOfWeek.THURSDAY,
    mealType: MealType.DINNER,
    dishes: [
      dish('Onion Rice', undefined, 'rice'),
      dish('Ivy Gourd Fry', undefined, 'sabzi'),
      dish('Cabbage Baji', undefined, 'sabzi'),
      dish('Dal', undefined, 'dal'),
      dish('Mothichoor Ladoo', undefined, 'dessert'),
    ],
    accompaniments: [
      'Plain Rice',
      'Chapati / Fulka',
      'Mix Salad',
      'Pickle',
      'Green Chilli / Lemon Slice',
    ],
    notes: ['Sweet limitation applies to Mothichoor Ladoo (Note 2)'],
  },

  // =============== FRIDAY ===============
  {
    id: 'fri-breakfast',
    dayOfWeek: DayOfWeek.FRIDAY,
    mealType: MealType.BREAKFAST,
    dishes: [
      dish('Masala Dosa', undefined, 'main'),
      dish('Sambar & Chutney', undefined, 'accompaniment'),
      dish('Green Moong Sprouts', undefined, 'side'),
    ],
    accompaniments: [
      'Fruits / Cornflakes (alternating weeks)',
      'BBJ - Bread Butter Jam',
      'Tea, Coffee, Milk, Bournvita / Horlicks',
    ],
    notes: ['No egg on Friday breakfast (source: "***" in egg row)'],
  },
  {
    id: 'fri-lunch',
    dayOfWeek: DayOfWeek.FRIDAY,
    mealType: MealType.LUNCH,
    dishes: [
      dish('Veg & Egg Biryani', undefined, 'rice'),
      dish('Mix Veg Raita', undefined, 'accompaniment'),
      dish('Black Channa Masala', undefined, 'sabzi'),
      dish('Chapati', ['Fulka'], 'bread'),
      dish('Lemon Juice', undefined, 'beverage'),
      dish('Curd', undefined, 'accompaniment'),
    ],
    accompaniments: [
      'Plain Rice',
      'Pickle',
      'Papad',
      'Mix Salad',
      'Green Chilli / Lemon Slice',
    ],
    notes: [
      'Chapati / Fulka: alternating weeks (Note 1)',
      'Afternoon eggs limited to 2 (Note 3)',
    ],
  },
  {
    id: 'fri-snacks',
    dayOfWeek: DayOfWeek.FRIDAY,
    mealType: MealType.SNACKS,
    dishes: [
      dish('Pasta', undefined, 'snack'),
    ],
    accompaniments: [
      'Red Chutney & Green Chutney',
      'Fruits',
      'BBJ - Bread Butter Jam',
      'Ginger Tea, Milk, Bournvita / Horlicks',
    ],
    notes: ['Fruit limitations apply (Note 2)'],
  },
  {
    id: 'fri-dinner',
    dayOfWeek: DayOfWeek.FRIDAY,
    mealType: MealType.DINNER,
    dishes: [
      dish('Tomato Rice', undefined, 'rice'),
      dish('Aloo 65', undefined, 'sabzi'),
      dish('Soyabean Sabzi Gravy', undefined, 'sabzi'),
      dish('Dal Tadka', undefined, 'dal'),
      dish('Gulab Jamun', undefined, 'dessert'),
    ],
    accompaniments: [
      'Plain Rice',
      'Chapati / Fulka',
      'Mix Salad',
      'Pickle',
      'Green Chilli / Lemon Slice',
    ],
    notes: ['Sweet limitation applies to Gulab Jamun (Note 2)'],
  },

  // =============== SATURDAY ===============
  {
    id: 'sat-breakfast',
    dayOfWeek: DayOfWeek.SATURDAY,
    mealType: MealType.BREAKFAST,
    dishes: [
      dish('Uthappam', undefined, 'main'),
      dish('Chutney', ['Coconut Chutney'], 'accompaniment'),
      dish('Matki Sprouts', undefined, 'side'),
      dish('Egg Bhurji', undefined, 'protein'),
    ],
    accompaniments: [
      'Fruits / Cornflakes (alternating weeks)',
      'BBJ - Bread Butter Jam',
      'Tea, Coffee, Milk, Bournvita / Horlicks',
    ],
    notes: ['Chutney / Coconut Chutney: alternating weeks (Note 1)'],
  },
  {
    id: 'sat-lunch',
    dayOfWeek: DayOfWeek.SATURDAY,
    mealType: MealType.LUNCH,
    dishes: [
      dish('Curd Rice', undefined, 'rice'),
      dish('Dal Palak', undefined, 'dal'),
      dish('Chole Bhature', undefined, 'bread'),
      dish('Hot Badam Milk', undefined, 'beverage'),
    ],
    accompaniments: [
      'Plain Rice',
      'Pickle',
      'Papad',
      'Mix Salad',
      'Green Chilli / Lemon Slice',
    ],
    notes: ['Afternoon eggs limited to 2 (Note 3)'],
  },
  {
    id: 'sat-snacks',
    dayOfWeek: DayOfWeek.SATURDAY,
    mealType: MealType.SNACKS,
    dishes: [
      dish('Masala Bhel', undefined, 'snack'),
    ],
    accompaniments: [
      'Red Chutney & Green Chutney',
      'Fruits',
      'BBJ - Bread Butter Jam',
      'Ginger Tea, Milk, Bournvita / Horlicks',
    ],
    notes: ['Fruit limitations apply (Note 2)'],
  },
  {
    id: 'sat-dinner',
    dayOfWeek: DayOfWeek.SATURDAY,
    mealType: MealType.DINNER,
    dishes: [
      dish('Jeera Rice', undefined, 'rice'),
      dish('Curd', undefined, 'accompaniment'),
      dish('Shahi Paneer', undefined, 'sabzi'),
      dish('Dal Kholapuri', undefined, 'dal'),
      dish('Ice Cream (Variety of Flavours)', undefined, 'dessert'),
    ],
    accompaniments: [
      'Plain Rice',
      'Chapati / Fulka',
      'Mix Salad',
      'Pickle',
      'Green Chilli / Lemon Slice',
    ],
    notes: ['Ice Cream: maximum 1 cup (Note 2)'],
  },

  // =============== SUNDAY ===============
  {
    id: 'sun-breakfast',
    dayOfWeek: DayOfWeek.SUNDAY,
    mealType: MealType.BREAKFAST,
    dishes: [
      dish('Vangi Bath', undefined, 'main'),
      dish('Aloo Mutter Sabzi', undefined, 'sabzi'),
      dish('Green Moong Sprouts', undefined, 'side'),
    ],
    accompaniments: [
      'Fruits / Cornflakes (alternating weeks)',
      'BBJ - Bread Butter Jam',
      'Tea, Coffee, Milk, Bournvita / Horlicks',
    ],
    notes: ['No egg on Sunday breakfast (source: "***" in egg row)'],
  },
  {
    id: 'sun-lunch',
    dayOfWeek: DayOfWeek.SUNDAY,
    mealType: MealType.LUNCH,
    dishes: [
      dish('Moong Dal', undefined, 'dal'),
      dish('Paneer Butter Masala', undefined, 'sabzi'),
      dish('Egg Curry', undefined, 'protein'),
      dish('Chapati', ['Fulka'], 'bread'),
      dish('Rasna', undefined, 'beverage'),
    ],
    accompaniments: [
      'Plain Rice',
      'Pickle',
      'Papad',
      'Mix Salad',
      'Green Chilli / Lemon Slice',
    ],
    notes: [
      'Chapati / Fulka: alternating weeks (Note 1)',
      'Afternoon eggs limited to 2 (Note 3)',
      'No specific rice variety listed for Sunday lunch in source (source: "***")',
    ],
  },
  {
    id: 'sun-snacks',
    dayOfWeek: DayOfWeek.SUNDAY,
    mealType: MealType.SNACKS,
    dishes: [
      dish('Girmit (Bhel)', undefined, 'snack'),
    ],
    accompaniments: [
      'Red Chutney & Green Chutney',
      'Fruits',
      'BBJ - Bread Butter Jam',
      'Ginger Tea, Milk, Bournvita / Horlicks',
    ],
    notes: ['Fruit limitations apply (Note 2)'],
  },
  {
    id: 'sun-dinner',
    dayOfWeek: DayOfWeek.SUNDAY,
    mealType: MealType.DINNER,
    dishes: [
      dish('Sorakay Chana', undefined, 'sabzi'),
      dish('Veg Kholapuri', undefined, 'sabzi'),
      dish('Moong Dal', undefined, 'dal'),
      dish('Jalebi', undefined, 'dessert'),
    ],
    accompaniments: [
      'Plain Rice',
      'Chapati / Fulka',
      'Mix Salad',
      'Pickle',
      'Green Chilli / Lemon Slice',
    ],
    notes: [
      'Sweet limitation applies to Jalebi (Note 2)',
      'No specific rice variety listed for Sunday dinner in source (source: "***")',
    ],
  },
];
