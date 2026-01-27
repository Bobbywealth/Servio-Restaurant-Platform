#!/usr/bin/env ts-node

/**
 * Generate AI Descriptions for Sashey's Menu Items
 * 
 * This script uses OpenAI to generate appetizing descriptions for all menu items
 * and updates them in the database.
 * 
 * Requirements:
 * - OPENAI_API_KEY must be set in .env file
 */

import dotenv from 'dotenv';
dotenv.config();

import { DatabaseService } from '../src/services/DatabaseService';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

const RESTAURANT_ID = 'sasheys-kitchen-union';

const jamaicanDescriptions: Record<string, string> = {
  // Breakfast Items
  'Ackee and Saltfish': 'Jamaica\'s national dish featuring tender salted cod cooked with creamy ackee fruit, seasoned with scallions, tomatoes, and Scotch bonnet peppers.',
  'Peanut, Carrot & Plantain Porridge': 'A hearty, nourishing porridge made with roasted peanuts, sweet carrots, and ripe plantains - a warming Jamaican breakfast staple.',
  'Butter bean and Saltfish': 'Butter beans simmered with seasoned salted cod, onions, and herbs - a protein-rich breakfast option.',
  'Beef Kidney': 'Tender beef kidney cooked Jamaican-style with spices and seasonings.',
  'Beef Liver': 'Sautéed beef liver with onions and peppers - rich in iron and flavor.',
  'Callaloo': 'Traditional Jamaican callaloo greens cooked with onions, garlic, and smoked pork, served steaming hot.',
  'Vegetarian Baked beans and saltfish': 'Creamy baked beans seasoned with herbs - a vegetarian twist on a classic.',
  'Cabbage with Saltfish': 'Fresh cabbage sautéed with seasoned salted cod and vegetables.',
  'Cornmeal Porridge': 'Creamy, smooth cornmeal porridge - a comforting breakfast warm-up.',
  
  // Daily Special
  'Mini Curry Chicken meal': 'A compact portion of tender chicken pieces simmered in aromatic Jamaican curry spices.',
  'Mini Stew Chicken meal': 'Slow-stewed chicken in a rich, savory gravy with traditional seasonings.',
  
  // Entrees
  'Oxtail Dinner': 'Tender, fall-off-the-bone oxtail braised in a rich brown stew gravy with butter beans.',
  'Jerk Chicken Dinner': 'Authentic Jamaican jerk chicken marinated in spicy herbs and slow-grilled to perfection.',
  'Curry Goat Dinner': 'Tender goat meat cooked in a fragrant curry blend with potatoes and carrots.',
  'Fried Chicken Dinner': 'Crispy, golden fried chicken with a blend of Jamaican seasonings.',
  'Curry Chicken Dinner': 'Succulent chicken pieces in a rich, aromatic Jamaican curry sauce.',
  'Stew Chicken Dinner': 'Chicken slow-cooked in a rich, savory brown stew with herbs and spices.',
  'Stew Beef Dinner': 'Tender beef chunks in a hearty brown stew gravy.',
  'Stew Peas with Pork and Beef': 'Red kidney beans simmered with pork and beef in a coconut-infused broth.',
  'Curry Shrimp Dinner': 'Fresh shrimp cooked in a fragrant Jamaican curry sauce.',
  'Vegetable Medley': 'A healthy mix of fresh Jamaican vegetables stir-fried with herbs.',
  'Red Snapper Fish Dinner': 'Whole red snapper seasoned and fried or stewed - Jamaica\'s beloved fish dish.',
  'Jerk Pork Dinner': 'Pork marinated in authentic jerk spices and grilled to smoky perfection.',
  'Curry Cowfoot Dinner': 'Tender cowfoot (ox foot) cooked in a rich curry sauce.',
  'Curry Chickpeas Dinner': 'Hearty chickpeas in a fragrant curry gravy.',
  'Jerk Chicken Reggae Rasta Pasta': 'Jerk chicken served over creamy reggae pasta with vegetables.',
  'Barbi-Fried Chicken': 'Jamaican-style BBQ fried chicken with a sweet and tangy glaze.',
  'Sweet Chili Wings Dinner': 'Wings glazed in a sweet and spicy chili sauce.',
  'Honey Jerk Wings Dinner': 'Jerk-seasoned wings finished with a honey glaze.',
  'Salmon Dinner': 'Fresh Atlantic salmon prepared Jamaican-style with herbs and spices.',
  'Jerk Chicken Salad': 'Shredded jerk chicken over fresh greens with tropical toppings.',
  'BBQ Jerked Chicken': 'Jerk chicken with BBQ glaze - the best of both worlds.',
  'Salmon Rasta Pasta': 'Creamy pasta with sautéed salmon and fresh vegetables.',
  'Chickpeas and Pumpkin Stew': 'Hearty chickpeas and sweet pumpkin in a savory stew.',
  'Jerk Chicken Only': 'Half a chicken worth of authentic Jamaican jerk chicken.',
  'Lobster Tail Twin': 'Two succulent lobster tails prepared to perfection.',
  'BBQ Pork Ribs': 'Fall-off-the-bone pork ribs with smoky BBQ sauce.',
  
  // Roti
  'Curry Chicken Roti': 'Flaky roti bread filled with tender curry chicken.',
  'Curry Goat Roti': 'Traditional roti wrapped around spicy curry goat.',
  
  // Wings
  'Plain Wings': 'Classic seasoned chicken wings - simple and delicious.',
  'Sweet Chili Wings': 'Wings tossed in a sweet chili glaze.',
  'BBQ Wings': 'Smoky BBQ glazed chicken wings.',
  'Honey Jerk Wings': 'Jerk-seasoned wings with sweet honey drizzle.',
  'Buffalo Wings': 'Classic Buffalo-style hot wings with tangy sauce.',
  
  // Patties
  'Oxtail Patty': 'Flaky pastry filled with savory oxtail seasoning.',
  'Veggie Patty': 'A savory vegetable-filled pastry turnover.',
  'Beef Patty': 'The classic Jamaican beef patty - spiced ground beef in flaky crust.',
  'Chicken Patty': 'Seasoned chicken filling in a golden pastry shell.',
  'Stew Beef Patty': 'Slow-cooked stewed beef in a warm pastry.',
  
  // Sides
  'Rice and Peas': 'Fragrant rice cooked in coconut milk with red kidney beans.',
  'White Rice': 'Steamed white rice - the perfect staple.',
  'Baked Mac and Cheese': 'Creamy macaroni baked with a crispy cheese topping.',
  'Steamed Cabbage': 'Lightly seasoned steamed cabbage.',
  'Fried Dumplings': 'Golden fried dough balls - crispy outside, soft inside.',
  'Fries': 'Crispy golden french fries.',
  'Plantain': 'Ripe fried plantains - sweet and savory.',
  'Roti': 'Traditional flaky Jamaican roti bread.',
  'Coco Bread': 'Soft, sweet bread rolls made with coconut.',
  'Festival': 'Sweet fried dough - a Jamaican favorite.',
  'Potato Salad': 'Creamy Jamaican-style potato salad.',
  'Macaroni Salad': 'Tangy macaroni pasta salad.',
  'Rasta Pasta': 'Creamy pasta with colorful vegetables.',
  'Mashed Potatoes': 'Smooth, buttery mashed potatoes.',
  
  // Soups
  'Chicken Soup': 'Hearty chicken soup with vegetables and herbs.',
  'Red Peas Soup': 'Red bean soup with salted meat and dumplings.',
  'Goat Soup': 'Nourishing goat meat soup with vegetables.',
  'Seafood Soup': 'A rich soup loaded with fresh seafood.',
  'Beef Soup': 'Comforting beef soup with vegetables.',
  
  // Desserts
  'Jamaican Fruit Rum Cake': 'Dense, moist cake infused with rum and dried fruits.',
  'Chocolate Cake': 'Rich, decadent chocolate layer cake.',
  'Red Velvet Cake': 'Classic red velvet with cream cheese frosting.',
  'Triple Chocolate Cake': 'Three layers of chocolate heaven.',
  'Sorrel Cake': 'Cake infused with hibiscus flower flavors.',
  'Banana Bread': 'Moist, flavorful banana bread.',
  'Coconut Rum Cheesecake': 'Creamy cheesecake with coconut and rum.',
  'Strawberry Cheesecake': 'New York style cheesecake with strawberry topping.',
  'Blueberry Cheesecake': 'Rich cheesecake topped with fresh blueberries.',
  'Carrot Cake': 'Spiced carrot cake with cream cheese frosting.',
  'Jamaican Sweet Potato Pudding': 'Traditional sweet potato pudding with spices.',
  'Black Forest': 'Chocolate cake with cherries and whipped cream.',
  'Coconut Bread Pudding': 'Bread pudding with coconut and warm spices.',
  'Pistachios Cheesecake': 'Creamy cheesecake topped with pistachios.',
  'Pineapple Upsidedown': 'Classic pineapple upside-down cake.',
  'Cherry Cheesecake': 'Cherry-topped creamy cheesecake.',
  'Piñacolada Cheesecake': 'Coconut and pineapple cheesecake.',
  'Oreo Cheesecake': 'Creamy cheesecake with Oreo crust.',
  'Peanut Cake': 'Dense, sweet cake with peanuts.',
  'Rum and Raisin Cheesecake': 'Cheesecake with rum-soaked raisins.',
  'Pistachio Cake': 'Moist cake with pistachio flavor.',
  'Caramel Crunch Cheesecake': 'Cheesecake with caramel and crunch topping.',
  'Carrot Cake (no icing)': 'Spiced carrot cake without frosting.',
  'Pumpkin Spice Cheesecake': 'Fall-flavored cheesecake with pumpkin.',
  'Carrot Cheesecake': 'Cheesecake infused with carrots.',
  'Lemon Cheesecake': 'Zesty lemon-flavored cheesecake.',
  'S\'mores Cheesecake': 'Cheesecake with chocolate, marshmallows, and graham.',
  'Rum Cake': 'Traditional Jamaican rum-soaked cake.',
  'Coconut Cream Cake': 'Light cake with coconut cream frosting.',
  'Banana Nut Bread': 'Banana bread with crunchy nuts.',
  'Rum and Raisin Cake': 'Cake with rum-soaked raisins.',
  'Marshmallow Coconut Bread Pudding': 'Bread pudding with marshmallows and coconut.',
  'Strawberry Bread Pudding': 'Bread pudding studded with strawberries.',
  'Blueberry Cake': 'Moist cake loaded with blueberries.',
  'Apple Cinnamon Cheesecake': 'Cheesecake with apples and cinnamon.',
  'Strawberry Cream Cake': 'Light cake with strawberry cream.',
  'Pumpkin Spice Bread Pudding': 'Bread pudding with pumpkin spice.',
  'Pre-order Black Cake (8 inches)': 'Traditional Jamaican black cake - 8 inch.',
  'Pre-order Black Cake (10 inches)': 'Traditional Jamaican black cake - 10 inch.',
  'Pre-order Black Cake (12 inches)': 'Traditional Jamaican black cake - 12 inch.',
  
  // Juices and Sodas
  'Water': 'Pure drinking water.',
  'Tropical Rhythm': 'Refreshing tropical fruit juice.',
  'Ting': 'Grapefruit soda from Jamaica.',
  'D&G Jamaican Soda': 'Classic Jamaican ginger soda.',
  'Pepsi': 'Chilled Pepsi.',
  'Ginger Ale': 'Classic ginger ale.',
  'Coke': 'Coca-Cola.',
  'Carrot Juice from Nature': 'Fresh-squeezed carrot juice.',
  'Sorrel and Ginger (natural juice)': 'Hibiscus flower and ginger beverage.',
  'Seamoss Peanut (natural juice)': 'Sea moss drink with peanuts.',
  'Beetroot w/ Milk': 'Beetroot smoothie with milk.',
  'Beetroot w/ Ginger': 'Fresh beetroot and ginger juice.',
  'Soursop and Lime (natural juice)': 'Tropical soursop with lime.',
  'Cucumber Ginger': 'Cooling cucumber and ginger juice.',
  'Ginger Beer': 'Spicy ginger beverage.',
  'Fresh Fruit Medley': 'Fresh tropical fruit juice blend.',
  'Fresh Ginger Juice': 'Pure fresh ginger juice.',
  'Snapple': 'Iced tea beverage.',
  'Squeez\'r Drink': 'Fruit punch drink.',
  'Soursop with milk': 'Creamy soursop smoothie.',
  'Pineapple Juice': 'Fresh pineapple juice.',
  '2 Liter Sodas': 'Large format soda.',
  'Crush Bottle': 'Orange cream soda.',
  'Coffee': 'Freshly brewed coffee.',
  'Beetroot with Peanut and Milk': 'Hearty beetroot smoothie.',
  'Lipton Iced Tea': 'Bottled iced tea.',
  'Mountain Dew': 'Citrus soda.',
  'Starry Bottle': 'Starfruit-flavored soda.',
  'Cran Water': 'Cranberry flavored water.',
  'Vitamalt Classics': 'Malted energy drink.',
  'Sprite': 'Lemon-lime soda.',
  'Sunkist': 'Orange soda.',
  'Canada Dry': 'Ginger ale.',
  'Bigga': 'Jamaican fruit punch soda.',
  'Tropicana': 'Orange juice.',
  'Papaya and Mango (natural juice)': 'Fresh tropical fruit juice.',
  'Strawberry Lemonade (bottle)': 'Strawberry flavored lemonade.',
  'Turkey Hill': 'Iced tea brand.',
  'Fanta': 'Fruit soda.',
  'Mistic': 'Fruit punch soda.',
  'Gatorade': 'Sports hydration drink.',
  'SeaBeets (Seamoss with Beetroot)': 'Sea moss and beetroot health drink.',
  'Pineapple Beets (Pineapple with Beetroot)': 'Pineapple and beetroot blend.',
  
  // Bread and Buns
  'National Spice Bun (Round)': 'Round Jamaican spice bun.',
  'Spice Fruit Bun': 'Fruit-filled spice bun.',
  'Royal Carribean Easter Buns': 'Traditional Easter buns.',
  'Royal Carribean Hard Dough Bread': 'Dense, crusty bread.',
  'National Giant Hardo Bread': 'Large traditional hard dough bread.',
  'Bun and Cheese': 'Spice bun with cheese.',
  'Rock Bun': 'Crumbly Jamaican rock bun.',
  'Nutmeg Bread': 'Bread infused with nutmeg.',
  'National Spice Bun': 'Standard Jamaican spice bun.',
  'Royal Carribean Spiced Fruit Bun': 'Fruit-filled spiced bun.',
  'National Easter Buns': 'Traditional Easter buns.',
  'Homemade Spice Bun Loaf': 'Fresh-baked spice bun loaf.',
  'The champion Jamaican Hardo bread': 'Premium hard dough bread.',
  
  // Snacks
  'Gizzada': 'Coconut tart with sweet crust.',
  'Peanut Drops': 'Hard candy made from roasted peanuts.',
  'Coconut Drops': 'Sweet coconut candy.',
  'Kiss Cake': 'Small sweet cake.',
  'National Cheese Curls': 'Jamaican cheese puffs.',
  'Jamaican Busta': 'Spicy chip snack.',
  
  // Catering
  'Oxtails & Beans': 'Large batch of tender oxtail with butter beans.',
  'Curried Chick Peas': 'Hearty curry chickpeas for crowds.',
  'Curried Goat': 'Traditional curry goat - party size.',
  'Jerked Chicken': 'Grilled jerk chicken - feeds a crowd.',
  'Stew Chicken': 'Brown stew chicken - family style.',
  'Red Snapper Fish': 'Whole fried red snapper.',
  'Curried Chicken': 'Aromatic curry chicken.',
  'Curried Shrimp': 'Curry shrimp platter.',
  'Jerked Pork': 'Smoky jerk pork.',
  'Stewed Beef': 'Hearty stewed beef.',
  'Honey Jerked Wings': 'Sweet and spicy wings.',
  'Fried Chicken': 'Crispy fried chicken pieces.',
  'Reggae Pasta': 'Creamy reggae pasta.',
  'Mac and Cheese': 'Baked mac and cheese.',
  'Steamed Cabbage': 'Steamed greens.',
  'Plain White Rice': 'Steamed white rice.',
  'Rice and Peas': 'Coconut rice and beans.',
  'Yellow Rice': 'Seasoned yellow rice.',
  'Jamaican Slaw': 'Tangy cabbage slaw.',
  'Potato Salad': 'Creamy potato salad.',
  'Cocktail patties': 'Mini Jamaican patties.',
  'Ackee and Saltfish': 'National dish party size.',
  
  // Salads
  'Tropical Salad': 'Fresh tropical fruits and greens.',
  'Crispy Chicken Salad': 'Chicken over fresh greens.',
  'Plain Salad': 'Simple mixed greens salad.',
};

async function generateDescriptions() {
  console.log('🔄 Starting AI description generation...\n');

  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️  OPENAI_API_KEY is not set in .env file.');
    console.log('   Please add your OpenAI API key to enable AI description generation.');
    console.log('   Example: OPENAI_API_KEY=sk-...');
    return;
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    await DatabaseService.initialize();
    const db = DatabaseService.getInstance().getDatabase();

    // Get all menu items for Sasheys
    const items = await db.all(
      `SELECT id, name, category_id, description FROM menu_items 
       WHERE restaurant_id = ? AND (description IS NULL OR description = '')`,
      [RESTAURANT_ID]
    );

    console.log(`📋 Found ${items.length} items needing descriptions\n`);

    let generated = 0;
    let skipped = 0;
    let errors = 0;

    for (const item of items) {
      // Check if we have a predefined description
      let description = jamaicanDescriptions[item.name];

      // If no predefined description, generate one with AI
      if (!description) {
        try {
          const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
              { role: 'system', content: 'You are a restaurant menu copywriter specializing in Jamaican cuisine.' },
              { role: 'user', content: `Write a concise, appetizing menu description for "${item.name}". Keep it 1-2 sentences, under 160 characters. Do not mention pricing.` }
            ],
            temperature: 0.7,
            max_tokens: 120
          });
          
          description = completion.choices[0]?.message?.content?.trim() || '';
        } catch (aiError) {
          console.error(`❌ AI error for "${item.name}":`, aiError);
          errors++;
          continue;
        }
      }

      if (description) {
        await db.run(
          `UPDATE menu_items SET description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [description, item.id]
        );
        console.log(`✅ Generated: ${item.name}`);
        console.log(`   "${description}"`);
        generated++;
      } else {
        console.log(`⚠️  Skipped: ${item.name} (no description available)`);
        skipped++;
      }
    }

    console.log('\n✅ Description generation completed!');
    console.log(`   Items with descriptions: ${generated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}`);

  } catch (error) {
    console.error('❌ Description generation failed:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  generateDescriptions()
    .then(() => {
      console.log('\n🎉 Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Failed:', error);
      process.exit(1);
    });
}

export { generateDescriptions };
