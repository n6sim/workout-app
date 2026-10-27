import type { Unit } from '../engine/nutrition'

/** About 30 simple meal ideas built only from pantry staples (spec: Meal suggestions).
 *  Only the amounts are written here. Calories and protein are worked out from the pantry, so they always match it. */
export interface IdeaItem {
  /** A pantry name from seedFoods.json. */
  food: string
  qty: number
  unit: Unit
}
export interface IdeaDef {
  id: string
  name: string
  items: IdeaItem[]
}

const i = (food: string, qty: number, unit: Unit): IdeaItem => ({ food, qty, unit })

export const MEAL_IDEAS: IdeaDef[] = [
  { id: 'scrambled-eggs-rye', name: 'Scrambled eggs on rye', items: [i('Egg, scrambled', 2, 'piece'), i('Bread, rye', 2, 'slice'), i('Butter', 5, 'g')] },
  { id: 'greek-yogurt-berries', name: 'Greek yogurt with blueberries and almonds', items: [i('Greek yogurt, plain 2%', 200, 'g'), i('Blueberries', 80, 'g'), i('Almonds', 15, 'g')] },
  { id: 'oats-banana', name: 'Oats with milk and banana', items: [i('Oats, rolled, dry', 50, 'g'), i('Milk, 2%', 200, 'ml'), i('Banana', 1, 'piece')] },
  { id: 'cottage-veg', name: 'Cottage cheese with cucumber and tomato', items: [i('Cottage cheese, 2%', 200, 'g'), i('Cucumber', 1, 'piece'), i('Tomato', 1, 'piece')] },
  { id: 'tuna-salad', name: 'Tuna salad', items: [i('Tuna, canned in water', 1, 'piece'), i('Mayonnaise, reduced fat', 1, 'tbsp'), i('Celery', 1, 'piece'), i('Lettuce, romaine', 50, 'g')] },
  { id: 'chicken-rice-broccoli', name: 'Chicken, rice and broccoli', items: [i('Chicken breast, grilled', 150, 'g'), i('Rice, white, cooked', 150, 'g'), i('Broccoli, raw', 100, 'g')] },
  { id: 'salmon-potato-beans', name: 'Salmon with potato and green beans', items: [i('Salmon, baked', 120, 'g'), i('Potato, boiled', 1, 'piece'), i('Green beans, boiled', 100, 'g')] },
  { id: 'lentil-bowl', name: 'Lentil and carrot bowl', items: [i('Lentils, boiled', 200, 'g'), i('Carrot', 1, 'piece'), i('Olive oil', 1, 'tsp')] },
  { id: 'hummus-wrap', name: 'Hummus and veggie wrap', items: [i('Tortilla, whole wheat', 1, 'piece'), i('Hummus', 60, 'g'), i('Cucumber', 80, 'g'), i('Spinach, raw', 30, 'g')] },
  { id: 'turkey-sandwich', name: 'Turkey and cheese sandwich', items: [i('Bread, whole wheat', 2, 'slice'), i('Turkey breast, roasted', 80, 'g'), i('Cheddar cheese', 30, 'g'), i('Lettuce, romaine', 20, 'g'), i('Mustard, yellow', 1, 'tsp')] },
  { id: 'veg-omelet', name: 'Veggie omelet with feta', items: [i('Egg, raw', 3, 'piece'), i('Mushrooms, white', 60, 'g'), i('Spinach, raw', 40, 'g'), i('Olive oil', 1, 'tsp'), i('Feta cheese', 20, 'g')] },
  { id: 'pb-banana-toast', name: 'Peanut butter banana toast', items: [i('Bread, whole wheat', 2, 'slice'), i('Peanut butter, natural', 2, 'tbsp'), i('Banana', 1, 'piece')] },
  { id: 'beef-stir-fry', name: 'Beef stir-fry with brown rice', items: [i('Beef tenderloin steak, broiled', 120, 'g'), i('Rice, brown, cooked', 150, 'g'), i('Red bell pepper', 1, 'piece'), i('Broccoli, raw', 100, 'g'), i('Canola oil', 1, 'tsp')] },
  { id: 'shrimp-pasta', name: 'Shrimp whole wheat pasta', items: [i('Shrimp, boiled', 120, 'g'), i('Pasta, whole wheat, cooked', 150, 'g'), i('Tomato', 1, 'piece'), i('Olive oil', 1, 'tsp'), i('Garlic', 2, 'piece'), i('Parmesan cheese', 10, 'g')] },
  { id: 'tofu-quinoa-bowl', name: 'Tofu and quinoa bowl', items: [i('Tofu, firm', 150, 'g'), i('Quinoa, cooked', 150, 'g'), i('Broccoli, raw', 100, 'g'), i('Carrot', 1, 'piece')] },
  { id: 'black-bean-bowl', name: 'Black bean burrito bowl', items: [i('Black beans, boiled', 150, 'g'), i('Rice, brown, cooked', 120, 'g'), i('Avocado', 0.5, 'piece'), i('Tomato', 1, 'piece'), i('Cheddar cheese', 20, 'g')] },
  { id: 'yogurt-almonds', name: 'Fat free Greek yogurt with almonds', items: [i('Greek yogurt, plain fat free', 170, 'g'), i('Almonds', 20, 'g')] },
  { id: 'apple-pb', name: 'Apple with peanut butter', items: [i('Apple', 1, 'piece'), i('Peanut butter, natural', 1, 'tbsp')] },
  { id: 'egg-wrap', name: 'Egg and spinach wrap', items: [i('Egg, boiled', 2, 'piece'), i('Tortilla, whole wheat', 1, 'piece'), i('Spinach, raw', 30, 'g'), i('Cheddar cheese', 20, 'g')] },
  { id: 'sardines-toast', name: 'Sardines and tomato on rye', items: [i('Sardines, canned in oil', 90, 'g'), i('Bread, rye', 2, 'slice'), i('Tomato', 1, 'piece')] },
  { id: 'overnight-oats', name: 'Overnight oats with strawberries', items: [i('Oats, rolled, dry', 40, 'g'), i('Greek yogurt, plain 2%', 100, 'g'), i('Milk, 2%', 100, 'ml'), i('Chia seeds', 10, 'g'), i('Strawberries', 100, 'g')] },
  { id: 'chicken-salad', name: 'Chicken salad with feta', items: [i('Chicken breast, grilled', 120, 'g'), i('Lettuce, romaine', 80, 'g'), i('Tomato', 1, 'piece'), i('Cucumber', 100, 'g'), i('Olive oil', 1, 'tbsp'), i('Feta cheese', 30, 'g')] },
  { id: 'pork-sweet-potato', name: 'Pork loin with sweet potato and peas', items: [i('Pork loin, roasted', 120, 'g'), i('Sweet potato, raw', 1, 'piece'), i('Green peas, boiled', 80, 'g')] },
  { id: 'cod-quinoa', name: 'Baked cod with quinoa and zucchini', items: [i('Cod, baked', 130, 'g'), i('Quinoa, cooked', 150, 'g'), i('Zucchini', 150, 'g'), i('Lemon juice', 1, 'tbsp')] },
  { id: 'banana-shake', name: 'Banana yogurt shake', items: [i('Banana', 1, 'piece'), i('Milk, 2%', 250, 'ml'), i('Greek yogurt, plain 2%', 100, 'g'), i('Oats, rolled, dry', 20, 'g')] },
  { id: 'cheese-fruit', name: 'Cheese, apple and almonds', items: [i('Cheddar cheese', 40, 'g'), i('Apple', 1, 'piece'), i('Almonds', 15, 'g')] },
  { id: 'hummus-veg', name: 'Hummus with carrot, cucumber and pepper', items: [i('Hummus', 80, 'g'), i('Carrot', 2, 'piece'), i('Cucumber', 1, 'piece'), i('Red bell pepper', 1, 'piece')] },
  { id: 'avocado-egg-toast', name: 'Avocado and egg on rye', items: [i('Bread, rye', 2, 'slice'), i('Avocado', 0.5, 'piece'), i('Egg, boiled', 2, 'piece')] },
  { id: 'lentil-spinach-egg', name: 'Lentils with spinach and an egg', items: [i('Lentils, boiled', 200, 'g'), i('Spinach, raw', 50, 'g'), i('Egg, boiled', 1, 'piece')] },
  { id: 'thigh-rice-cabbage', name: 'Chicken thigh, rice and cabbage', items: [i('Chicken thigh, roasted', 130, 'g'), i('Rice, white, cooked', 150, 'g'), i('Cabbage', 100, 'g'), i('Olive oil', 1, 'tsp')] },
]
