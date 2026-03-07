// Servio AI Kitchen Assistant - Enhanced Demo Version
// Interactive demo with real Web Speech API and Text-to-Speech

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  ChefHat,
  Clock,
  BookOpen,
  Scale,
  Users,
  CheckCircle,
  ArrowRight,
  X,
  UtensilsCrossed,
  Timer,
  Flame,
  MessageCircle,
  Settings,
  SkipForward,
  SkipBack,
  ListChecks,
  Sparkles,
  AlertCircle,
  Headphones
} from 'lucide-react';

// Recipe categories
const RECIPE_CATEGORIES = [
  { id: 'all', name: 'All Recipes', emoji: '🍽️' },
  { id: 'main', name: 'Main Dishes', emoji: '🍖' },
  { id: 'sides', name: 'Sides', emoji: '🍚' },
  { id: 'desserts', name: 'Desserts', emoji: '🍰' },
];

// Demo recipes with more details
const DEMO_RECIPES = [
  {
    id: 1,
    name: 'Jerk Chicken',
    description: 'Classic Jamaican jerk chicken with authentic spices',
    difficulty: 'Medium',
    prepTime: 30,
    cookTime: 45,
    totalTime: 75,
    servings: 20,
    cuisine: 'Jamaican',
    category: 'main',
    image: '🍗',
    color: 'from-orange-500 to-red-600',
    steps: [
      { number: 1, instruction: 'Wash and clean the chicken pieces thoroughly', timer: null, tip: 'Use cold water and remove any feathers' },
      { number: 2, instruction: 'Pat dry with paper towels', timer: null, tip: 'Dry chicken helps marinade stick better' },
      { number: 3, instruction: 'Mix all dry spices in a bowl: salt, garlic powder, onion powder, thyme, allspice, cayenne, paprika, and brown sugar', timer: null, tip: 'Combine spices thoroughly before adding wet ingredients' },
      { number: 4, instruction: 'Add soy sauce, vegetable oil, and lime juice to the spice mix to form a paste', timer: null, tip: 'The paste should be thick enough to coat the chicken' },
      { number: 5, instruction: 'Coat chicken pieces evenly with the jerk marinade', timer: null, tip: 'Massage the marinade into the chicken for best results' },
      { number: 6, instruction: 'Marinate chicken in the refrigerator', timer: 7200, tip: 'Overnight marination gives the best flavor', notes: 'This step is crucial for authentic jerk flavor' },
      { number: 7, instruction: 'Preheat oven to 375°F (190°C)', timer: null, tip: 'Let oven fully preheat before cooking' },
      { number: 8, instruction: 'Place chicken on a baking sheet or grill', timer: 1500, tip: 'Leave space between pieces for crispy skin', notes: 'Flip halfway through cooking' },
      { number: 9, instruction: 'Flip chicken halfway through cooking', timer: null, tip: 'Use tongs to avoid piercing the meat' },
      { number: 10, instruction: 'Check internal temperature reaches 165°F (74°C)', timer: null, tip: 'Use a meat thermometer for accuracy' },
      { number: 11, instruction: 'Let rest for 5 minutes before serving', timer: 300, tip: 'Resting keeps juices in the meat', notes: 'This step makes the chicken juicier' }
    ],
    ingredients: [
      { name: 'Chicken pieces', amount: 20, unit: 'lbs' },
      { name: 'Salt', amount: 3, unit: 'tbsp' },
      { name: 'Garlic powder', amount: 2, unit: 'tbsp' },
      { name: 'Onion powder', amount: 2, unit: 'tbsp' },
      { name: 'Thyme', amount: 1, unit: 'tbsp' },
      { name: 'Allspice', amount: 2, unit: 'tbsp' },
      { name: 'Cayenne pepper', amount: 1, unit: 'tbsp' },
      { name: 'Paprika', amount: 1, unit: 'tbsp' },
      { name: 'Brown sugar', amount: 2, unit: 'tbsp' },
      { name: 'Soy sauce', amount: 4, unit: 'tbsp' },
      { name: 'Vegetable oil', amount: 4, unit: 'tbsp' },
      { name: 'Lime juice', amount: 3, unit: 'tbsp' }
    ]
  },
  {
    id: 2,
    name: 'Rice and Peas',
    description: 'Traditional Jamaican rice and peas with coconut milk',
    difficulty: 'Easy',
    prepTime: 15,
    cookTime: 35,
    totalTime: 50,
    servings: 20,
    cuisine: 'Jamaican',
    category: 'sides',
    image: '🍚',
    color: 'from-green-500 to-emerald-700',
    steps: [
      { number: 1, instruction: 'Rinse rice thoroughly until water runs clear', timer: null, tip: 'This removes excess starch' },
      { number: 2, instruction: 'Drain kidney beans and set aside', timer: null, tip: 'Rinse beans to remove canned taste' },
      { number: 3, instruction: 'In a large pot, combine coconut milk, kidney beans, scotch bonnet peppers, garlic, thyme, and salt', timer: null, tip: 'Use a big pot to prevent boiling over' },
      { number: 4, instruction: 'Bring to a boil over high heat', timer: null, tip: 'Watch for overflow' },
      { number: 5, instruction: 'Add rice and stir well', timer: null, tip: 'Ensure rice is evenly distributed' },
      { number: 6, instruction: 'Reduce heat to low, cover tightly', timer: 1800, tip: 'Don\'t lift the lid while cooking', notes: 'Low and slow is the key' },
      { number: 7, instruction: 'Cook until rice is tender and liquid is absorbed', timer: null, tip: 'Check after 20 minutes' },
      { number: 8, instruction: 'Remove scotch bonnet peppers, add butter and fluff with fork', timer: null, tip: 'Leave peppers in for mild heat or remove for no heat', notes: 'Fluffing separates the grains' }
    ],
    ingredients: [
      { name: 'Long grain rice', amount: 10, unit: 'cups' },
      { name: 'Coconut milk', amount: 4, unit: 'cups' },
      { name: 'Kidney beans', amount: 4, unit: 'cups' },
      { name: 'Scotch bonnet pepper', amount: 2, unit: 'whole' },
      { name: 'Garlic', amount: 6, unit: 'cloves' },
      { name: 'Thyme', amount: 1, unit: 'tbsp' },
      { name: 'Salt', amount: 2, unit: 'tbsp' },
      { name: 'Butter', amount: 4, unit: 'tbsp' }
    ]
  },
  {
    id: 3,
    name: 'Curry Goat',
    description: 'Aromatic curry goat with potatoes',
    difficulty: 'Medium',
    prepTime: 45,
    cookTime: 120,
    totalTime: 165,
    servings: 15,
    cuisine: 'Jamaican',
    category: 'main',
    image: '🍖',
    color: 'from-yellow-500 to-amber-700',
    steps: [
      { number: 1, instruction: 'Cut goat meat into 2-inch cubes and wash thoroughly', timer: null, tip: 'Uniform pieces cook evenly' },
      { number: 2, instruction: 'Pat meat dry with paper towels', timer: null, tip: 'Dry meat browns better' },
      { number: 3, instruction: 'Season with curry powder, salt, and half the thyme', timer: null, tip: 'Let sit for 15 minutes' },
      { number: 4, instruction: 'Heat oil in a large pot over high heat', timer: null, tip: 'Hot oil seals in juices' },
      { number: 5, instruction: 'Brown goat meat in batches, about 3-4 minutes per side', timer: 1200, tip: 'Don\'t overcrowd the pot', notes: 'Browning adds flavor' },
      { number: 6, instruction: 'Remove meat and sauté onions until softened', timer: 300, tip: 'Cook onions until translucent' },
      { number: 7, instruction: 'Add garlic, ginger, and tomatoes, cook for 2 minutes', timer: 120, tip: 'Fragrant aromatics' },
      { number: 8, instruction: 'Return meat to pot, add remaining thyme and scotch bonnet', timer: null, tip: 'Add scotch bonnets whole for mild heat' },
      { number: 9, instruction: 'Add coconut milk and bring to a boil', timer: null, tip: 'Use full-fat coconut milk' },
      { number: 10, instruction: 'Reduce heat, cover and simmer until meat is tender', timer: 5400, tip: 'Low and slow tenderizes the meat', notes: 'Check after 1.5 hours' },
      { number: 11, instruction: 'Add potatoes and cook until tender', timer: 1200, tip: 'Add potatoes in last 20 minutes' },
      { number: 12, instruction: 'Adjust seasoning and serve hot', timer: null, tip: 'Taste and adjust salt and curry' }
    ],
    ingredients: [
      { name: 'Goat meat', amount: 15, unit: 'lbs' },
      { name: 'Curry powder', amount: 4, unit: 'tbsp' },
      { name: 'Onions', amount: 4, unit: 'large' },
      { name: 'Garlic', amount: 8, unit: 'cloves' },
      { name: 'Ginger', amount: 3, unit: 'inches' },
      { name: 'Tomatoes', amount: 4, unit: 'large' },
      { name: 'Potatoes', amount: 6, unit: 'medium' },
      { name: 'Vegetable oil', amount: 6, unit: 'tbsp' },
      { name: 'Thyme', amount: 2, unit: 'tbsp' },
      { name: 'Salt', amount: 2, unit: 'tbsp' },
      { name: 'Scotch bonnet', amount: 2, unit: 'whole' },
      { name: 'Coconut milk', amount: 2, unit: 'cups' }
    ]
  },
  {
    id: 4,
    name: 'Fried Rice',
    description: 'Classic fried rice with vegetables and eggs',
    difficulty: 'Easy',
    prepTime: 15,
    cookTime: 20,
    totalTime: 35,
    servings: 10,
    cuisine: 'Asian',
    category: 'main',
    image: '🍳',
    color: 'from-yellow-400 to-orange-500',
    steps: [
      { number: 1, instruction: 'Cook rice and let it cool completely', timer: null, tip: 'Day-old rice works best', notes: 'Cold rice doesn\'t get mushy' },
      { number: 2, instruction: 'Beat eggs and scramble in hot wok', timer: 120, tip: 'Set eggs aside after cooking' },
      { number: 3, instruction: 'Stir-fry vegetables until crisp-tender', timer: 180, tip: 'Keep vegetables crunchy' },
      { number: 4, instruction: 'Add cold rice and break up clumps', timer: null, tip: 'Use cold hands or spatula' },
      { number: 5, instruction: 'Add soy sauce and sesame oil', timer: null, tip: 'Toast sesame oil for more flavor' },
      { number: 6, instruction: 'Return eggs and mix thoroughly', timer: null, tip: 'Distribute eggs evenly' },
      { number: 7, instruction: 'Season with salt and pepper, serve hot', timer: null, tip: 'Garnish with green onions' }
    ],
    ingredients: [
      { name: 'Cooked rice', amount: 8, unit: 'cups' },
      { name: 'Eggs', amount: 4, unit: 'large' },
      { name: 'Carrots', amount: 2, unit: 'diced' },
      { name: 'Peas', amount: 1, unit: 'cup' },
      { name: 'Green onions', amount: 4, unit: 'sliced' },
      { name: 'Soy sauce', amount: 3, unit: 'tbsp' },
      { name: 'Sesame oil', amount: 1, unit: 'tbsp' },
      { name: 'Vegetable oil', amount: 3, unit: 'tbsp' }
    ]
  },
  {
    id: 5,
    name: 'Rum Cake',
    description: 'Moist Jamaican rum cake soaked in spiced rum syrup',
    difficulty: 'Medium',
    prepTime: 30,
    cookTime: 60,
    totalTime: 90,
    servings: 16,
    cuisine: 'Jamaican',
    category: 'desserts',
    image: '🎂',
    color: 'from-amber-600 to-yellow-800',
    steps: [
      { number: 1, instruction: 'Preheat oven to 325°F (165°C) and grease a bundt pan generously', timer: null, tip: 'Use butter and flour to coat every crevice of the pan' },
      { number: 2, instruction: 'Sprinkle chopped walnuts or pecans evenly in the bottom of the pan', timer: null, tip: 'Nuts become the topping when cake is inverted' },
      { number: 3, instruction: 'In a bowl, combine cake mix, instant pudding mix, eggs, cold water, vegetable oil, and dark rum', timer: null, tip: 'Mix until smooth — do not over-beat' },
      { number: 4, instruction: 'Pour batter over the nuts in the pan', timer: null, tip: 'Tap the pan gently on the counter to remove air bubbles' },
      { number: 5, instruction: 'Bake until a toothpick inserted in center comes out clean', timer: 3600, tip: 'Check at 50 minutes — ovens vary', notes: 'The cake should be golden brown and pull away from the sides' },
      { number: 6, instruction: 'While cake bakes, make the rum syrup: melt butter in saucepan, stir in sugar and water, bring to a boil for 5 minutes', timer: 300, tip: 'Stir constantly to prevent burning' },
      { number: 7, instruction: 'Remove syrup from heat and carefully stir in dark rum', timer: null, tip: 'Add rum off heat to prevent flare-ups' },
      { number: 8, instruction: 'When cake is done, let cool in pan for 5 minutes, then invert onto a wire rack over a tray', timer: 300, tip: 'Don\'t wait too long or the cake will stick' },
      { number: 9, instruction: 'Poke holes all over the warm cake with a skewer or fork', timer: null, tip: 'More holes = more rum absorbed' },
      { number: 10, instruction: 'Slowly spoon the warm rum syrup over the cake, letting it absorb before adding more', timer: null, tip: 'Use all the syrup — the cake should be well soaked' },
      { number: 11, instruction: 'Let cake cool completely before slicing and serving', timer: 1800, tip: 'The flavor deepens as the cake cools and rum distributes', notes: 'Can be stored tightly wrapped for up to a week — it gets better with time!' }
    ],
    ingredients: [
      { name: 'Yellow cake mix', amount: 2, unit: 'boxes' },
      { name: 'Instant vanilla pudding mix', amount: 2, unit: 'boxes' },
      { name: 'Eggs', amount: 8, unit: 'large' },
      { name: 'Cold water', amount: 1, unit: 'cup' },
      { name: 'Vegetable oil', amount: 1, unit: 'cup' },
      { name: 'Dark rum', amount: 1, unit: 'cup' },
      { name: 'Chopped walnuts', amount: 2, unit: 'cups' },
      { name: 'Butter (for syrup)', amount: 1, unit: 'cup' },
      { name: 'Sugar (for syrup)', amount: 2, unit: 'cups' },
      { name: 'Water (for syrup)', amount: 0.5, unit: 'cup' },
      { name: 'Dark rum (for syrup)', amount: 1, unit: 'cup' }
    ]
  },
  {
    id: 6,
    name: 'Festival Dumplings',
    description: 'Sweet Jamaican fried dumplings, a classic street food side',
    difficulty: 'Easy',
    prepTime: 15,
    cookTime: 20,
    totalTime: 35,
    servings: 20,
    cuisine: 'Jamaican',
    category: 'sides',
    image: '🌽',
    color: 'from-yellow-400 to-amber-500',
    steps: [
      { number: 1, instruction: 'Combine cornmeal, flour, sugar, baking powder, and salt in a large bowl', timer: null, tip: 'Whisk dry ingredients well to distribute baking powder evenly' },
      { number: 2, instruction: 'Add vanilla extract and gradually mix in water until a soft dough forms', timer: null, tip: 'Add water slowly — the dough should not be sticky' },
      { number: 3, instruction: 'Knead dough gently for 1-2 minutes until smooth', timer: null, tip: 'Don\'t over-knead or festivals will be tough' },
      { number: 4, instruction: 'Divide dough into 20 equal portions and roll each into a log shape, slightly tapered at the ends', timer: null, tip: 'Uniform size ensures even cooking' },
      { number: 5, instruction: 'Heat oil in a deep pan to 350°F (175°C)', timer: null, tip: 'Test oil readiness with a small piece of dough — it should float and bubble' },
      { number: 6, instruction: 'Fry festivals in batches, turning occasionally, until golden brown', timer: 600, tip: 'Don\'t overcrowd the pan — fry 4-5 at a time', notes: 'They should be deep golden all over' },
      { number: 7, instruction: 'Drain on paper towels and serve warm', timer: null, tip: 'Best served immediately alongside jerk chicken or ackee and saltfish' }
    ],
    ingredients: [
      { name: 'Cornmeal', amount: 4, unit: 'cups' },
      { name: 'All-purpose flour', amount: 2, unit: 'cups' },
      { name: 'Sugar', amount: 6, unit: 'tbsp' },
      { name: 'Baking powder', amount: 2, unit: 'tsp' },
      { name: 'Salt', amount: 1, unit: 'tsp' },
      { name: 'Vanilla extract', amount: 1, unit: 'tsp' },
      { name: 'Water', amount: 2, unit: 'cups' },
      { name: 'Vegetable oil (for frying)', amount: 4, unit: 'cups' }
    ]
  }
];

interface ActiveSession {
  recipe: typeof DEMO_RECIPES[0];
  currentStep: number;
  status: 'active' | 'paused' | 'completed';
  timer: number | null;
  timerRunning: boolean;
  scaledServings: number;
  completedSteps: number[];
}

// Sample commands for quick actions
const QUICK_COMMANDS = [
  { label: 'Next Step', command: 'next', icon: SkipForward },
  { label: 'Previous', command: 'previous', icon: SkipBack },
  { label: 'Ingredients', command: 'show ingredients', icon: ListChecks },
  { label: 'Repeat', command: 'repeat', icon: RotateCcw },
  { label: 'Pause', command: 'pause', icon: Pause },
  { label: 'Resume', command: 'resume', icon: Play },
];

export default function KitchenAssistantDemo() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [showRecipeSelector, setShowRecipeSelector] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showBatchSizePrompt, setShowBatchSizePrompt] = useState(false);
  const [pendingRecipe, setPendingRecipe] = useState<typeof DEMO_RECIPES[0] | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [showIngredients, setShowIngredients] = useState(false);
  const [showTips, setShowTips] = useState(true);
  const [trainingMode, setTrainingMode] = useState(false);
  const [volumeOn, setVolumeOn] = useState(true);
  const [history, setHistory] = useState<{ type: 'user' | 'ai'; text: string }[]>([]);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [recognition, setRecognition] = useState<any>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  // Filter recipes by category
  const filteredRecipes = selectedCategory === 'all' 
    ? DEMO_RECIPES 
    : DEMO_RECIPES.filter(r => r.category === selectedCategory);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioLevelRef = useRef<NodeJS.Timeout | null>(null);

  // Check for Web Speech API support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      setTranscript(transcript.toLowerCase());
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      if (isListening) {
        recognition.start();
      }
    };

    setRecognition(recognition);

    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, [isListening]);

  // Format time
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Start recipe with batch size
  const startRecipeWithBatchSize = (servings: number) => {
    if (!pendingRecipe) return;
    
    const step = pendingRecipe.steps[0];
    setActiveSession({
      recipe: pendingRecipe,
      currentStep: 1,
      status: 'active',
      timer: step.timer,
      timerRunning: false,
      scaledServings: servings,
      completedSteps: []
    });
    processCommand(`start ${pendingRecipe.name} for ${servings} servings`);
    setShowBatchSizePrompt(false);
    setPendingRecipe(null);
    speak(`Great! I'll walk you through making ${pendingRecipe.name} for ${servings} people. Let's get started!`);
  };

  // Text-to-Speech
  const speak = useCallback((text: string) => {
    if (!volumeOn || !text) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }, [volumeOn]);

  // Timer logic
  useEffect(() => {
    if (activeSession?.timer && activeSession.timerRunning && activeSession.timer > 0) {
      timerRef.current = setInterval(() => {
        setActiveSession(prev => {
          if (!prev || !prev.timerRunning) return prev;
          if (prev.timer && prev.timer > 0) {
            return { ...prev, timer: prev.timer - 1 };
          }
          return prev;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeSession?.timer, activeSession?.timerRunning]);

  // Simulate audio level when listening
  useEffect(() => {
    if (isListening) {
      audioLevelRef.current = setInterval(() => {
        setAudioLevel(Math.random() * 100);
      }, 100);
    } else {
      setAudioLevel(0);
      if (audioLevelRef.current) clearInterval(audioLevelRef.current);
    }

    return () => {
      if (audioLevelRef.current) clearInterval(audioLevelRef.current);
    };
  }, [isListening]);

  // Process voice command
  const processCommand = (text: string) => {
    const lowerText = text.toLowerCase();
    let response = '';

    setHistory(prev => [...prev, { type: 'user', text }]);

    // Start recipe
    if (lowerText.includes('start') || lowerText.includes('begin') || lowerText.includes('make')) {
      const recipeName = DEMO_RECIPES.find(r => 
        lowerText.includes(r.name.toLowerCase())
      );

      if (recipeName) {
        const step = recipeName.steps[0];
        setActiveSession({
          recipe: recipeName,
          currentStep: 1,
          status: 'active',
          timer: step.timer,
          timerRunning: false,
          scaledServings: recipeName.servings,
          completedSteps: []
        });
        response = `Starting ${recipeName.name}. Batch size: ${recipeName.servings} servings. ${recipeName.description}. Step 1: ${step.instruction}. ${step.tip ? `Tip: ${step.tip}` : ''}. Tell me "next step" when you're ready to continue.`;
      } else {
        response = `I couldn't find that recipe. Available recipes are: ${DEMO_RECIPES.map(r => r.name).join(', ')}. Just say "start" followed by the recipe name.`;
      }
    }
    // Next step
    else if (lowerText.includes('next')) {
      if (!activeSession) {
        response = 'No active recipe. Please start a recipe first. Say "start" and the recipe name.';
      } else if (activeSession.status === 'completed') {
        response = 'You\'ve already completed this recipe! Say "start" to begin a new recipe.';
      } else {
        const nextStepNum = activeSession.currentStep + 1;
        const completedSteps = activeSession.completedSteps.includes(activeSession.currentStep)
          ? activeSession.completedSteps
          : [...activeSession.completedSteps, activeSession.currentStep];
        if (nextStepNum > activeSession.recipe.steps.length) {
          response = `🎉 Congratulations! You have completed ${activeSession.recipe.name}! Great job! All ${activeSession.recipe.steps.length} steps are done. Enjoy your meal!`;
          setActiveSession({ ...activeSession, status: 'completed', completedSteps });
        } else {
          const nextStep = activeSession.recipe.steps[nextStepNum - 1];
          setActiveSession({
            ...activeSession,
            currentStep: nextStepNum,
            timer: nextStep.timer,
            timerRunning: false,
            completedSteps
          });
          response = trainingMode 
            ? `📚 Training Mode - Step ${nextStepNum} of ${activeSession.recipe.steps.length}: ${nextStep.instruction}. ${nextStep.notes || nextStep.tip ? `💡 ${nextStep.notes || nextStep.tip}` : ''}`
            : `Step ${nextStepNum}: ${nextStep.instruction}. ${nextStep.timer ? `⏱️ This step takes ${Math.floor(nextStep.timer / 60)} minutes.` : ''}`;
        }
      }
    }
    // Previous step
    else if (lowerText.includes('previous') || lowerText.includes('go back') || lowerText.includes('last')) {
      if (!activeSession) {
        response = 'No active recipe to go back.';
      } else if (activeSession.currentStep <= 1) {
        response = 'You are already at the first step. Say "next" to move forward.';
      } else {
        const prevStepNum = activeSession.currentStep - 1;
        const prevStep = activeSession.recipe.steps[prevStepNum - 1];
        setActiveSession({
          ...activeSession,
          currentStep: prevStepNum,
          timer: prevStep.timer,
          timerRunning: false
        });
        response = `Going back to Step ${prevStepNum}: ${prevStep.instruction}`;
      }
    }
    // Repeat
    else if (lowerText.includes('repeat') || lowerText.includes('say again') || lowerText.includes('what')) {
      if (!activeSession) {
        response = 'No active recipe. Start a recipe first.';
      } else {
        const currentStep = activeSession.recipe.steps[activeSession.currentStep - 1];
        response = `Step ${activeSession.currentStep}: ${currentStep.instruction}. ${currentStep.tip ? `Tip: ${currentStep.tip}` : ''}`;
      }
    }
    // Show ingredients
    else if (lowerText.includes('ingredient')) {
      if (!activeSession) {
        response = 'Start a recipe first to see ingredients.';
      } else {
        const scaledAmount = (amount: number) => 
          Math.round((amount / activeSession.recipe.servings) * activeSession.scaledServings * 10) / 10;
        
        const ingredients = activeSession.recipe.ingredients
          .map(i => `${scaledAmount(i.amount)} ${i.unit} ${i.name}`)
          .join(', ');
        response = `📋 Ingredients for ${activeSession.recipe.name} (scaled to ${activeSession.scaledServings} servings): ${ingredients}. Say "show ingredients" to view the full list.`;
      }
    }
    // Scale recipe
    else if (lowerText.includes('scale')) {
      const servingsMatch = lowerText.match(/(\d+)\s*(servings?|portions?|people)/);
      if (!activeSession) {
        response = 'Start a recipe first to scale it.';
      } else if (!servingsMatch) {
        response = 'How many servings? For example: "Scale to 40 servings"';
      } else {
        const newServings = parseInt(servingsMatch[1]);
        setActiveSession({ ...activeSession, scaledServings: newServings });
        const scaleFactor = newServings / activeSession.recipe.servings;
        response = `✅ Recipe scaled from ${activeSession.recipe.servings} to ${newServings} servings (${scaleFactor > 1 ? `${Math.round(scaleFactor * 100)}% increase` : `${Math.round(scaleFactor * 100)}% of original`}). All ingredient quantities have been adjusted.`;
      }
    }
    // Training mode
    else if (lowerText.includes('training') || lowerText.includes('learn')) {
      if (trainingMode) {
        response = 'Training mode is already enabled. You\'ll receive detailed tips for each step.';
      } else {
        setTrainingMode(true);
        if (activeSession) {
          const currentStep = activeSession.recipe.steps[activeSession.currentStep - 1];
          response = `📚 Training Mode enabled! Step ${activeSession.currentStep}: ${currentStep.instruction}. 💡 ${currentStep.notes || currentStep.tip || 'Pay attention to this step as it affects the final dish quality.'}`;
        } else {
          response = 'Training mode enabled. Start a recipe to begin your culinary training!';
        }
      }
    }
    // Exit training mode
    else if (lowerText.includes('normal') || lowerText.includes('cooking mode')) {
      setTrainingMode(false);
      response = 'Switched to cooking mode. Step-by-step instructions without extra tips.';
    }
    // Stop
    else if (lowerText.includes('stop') || lowerText.includes('done') || lowerText.includes('finish')) {
      if (activeSession) {
        const completed = activeSession.completedSteps.length;
        const total = activeSession.recipe.steps.length;
        setActiveSession(null);
        response = `🍽️ Cooking session ended. You completed ${completed} of ${total} steps in ${activeSession.recipe.name}. Thank you for using Servio AI Kitchen Assistant!`;
      } else {
        response = 'No active cooking session to stop.';
      }
    }
    // Pause
    else if (lowerText.includes('pause') || lowerText.includes('hold') || lowerText.includes('wait')) {
      if (activeSession && activeSession.status === 'active') {
        setActiveSession({ ...activeSession, status: 'paused', timerRunning: false });
        response = '⏸️ Cooking paused. Say "resume" or "continue" to keep cooking.';
      } else if (activeSession?.status === 'paused') {
        response = 'Cooking is already paused. Say "resume" to continue.';
      } else {
        response = 'No active cooking session to pause.';
      }
    }
    // Resume
    else if (lowerText.includes('resume') || lowerText.includes('continue') || lowerText.includes('keep going')) {
      if (activeSession && activeSession.status === 'paused') {
        setActiveSession({ ...activeSession, status: 'active', timerRunning: true });
        response = '▶️ Cooking resumed! Continuing from where we left off.';
      } else if (activeSession?.status === 'active') {
        response = 'Cooking is already in progress!';
      } else {
        response = 'No paused cooking session to resume.';
      }
    }
    // Timer
    else if (lowerText.includes('timer') || lowerText.includes('how long') || lowerText.includes('time')) {
      if (activeSession?.timer) {
        response = `⏱️ Timer shows ${formatTime(activeSession.timer)} remaining for this step.`;
      } else if (activeSession?.recipe.steps[activeSession.currentStep - 1]?.timer) {
        const stepTimer = activeSession.recipe.steps[activeSession.currentStep - 1].timer;
        if (stepTimer) {
          response = `This step has a timer of ${formatTime(stepTimer)}. Say "start timer" to begin.`;
        } else {
          response = 'No timer is currently set for this step.';
        }
      } else {
        response = 'No timer is currently set for this step.';
      }
    }
    // Start timer
    else if (lowerText.includes('start timer') || lowerText.includes('begin timer')) {
      if (activeSession?.timer) {
        setActiveSession({ ...activeSession, timerRunning: true });
        response = `⏱️ Timer started! ${formatTime(activeSession.timer)} remaining.`;
      } else {
        response = 'No timer available for this step.';
      }
    }
    // Check progress
    else if (lowerText.includes('progress') || lowerText.includes('how many') || lowerText.includes('where')) {
      if (!activeSession) {
        response = 'No active recipe.';
      } else {
        const progress = Math.round((activeSession.currentStep / activeSession.recipe.steps.length) * 100);
        response = `📊 Progress: Step ${activeSession.currentStep} of ${activeSession.recipe.steps.length} (${progress}% complete).`;
      }
    }
    // Help
    else if (lowerText.includes('help') || lowerText.includes('what can')) {
      response = `🆘 Here's what you can say:
• "Start [recipe name]" - Begin cooking
• "Next step" or "Previous" - Navigate steps
• "Show ingredients" - View ingredients
• "Scale to [number] servings" - Adjust recipe
• "Pause" or "Resume" - Control cooking
• "Repeat" - Hear current step again
• "Training mode" - Get detailed tips
• "Stop" - End cooking session`;
    }
    // Default
    else {
      response = "🤔 I didn't understand that. Try saying 'Start jerk chicken', 'Next step', 'Show ingredients', or 'Help' for more commands.";
    }

    // Simulate AI delay and speak response
    setTimeout(() => {
      setAiResponse(response);
      setHistory(prev => [...prev, { type: 'ai', text: response }]);
      speak(response);
    }, 300);
  };

  // Handle voice input toggle
  const toggleVoiceInput = () => {
    if (!speechSupported) {
      alert('Speech recognition is not supported in your browser. Try using Chrome or Edge.');
      return;
    }

    if (isListening) {
      recognition?.stop();
      setIsListening(false);
      if (transcript.trim()) {
        processCommand(transcript);
      }
      setTranscript('');
    } else {
      setTranscript('');
      recognition?.start();
      setIsListening(true);
    }
  };

  // Handle manual command input
  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (transcript.trim()) {
      processCommand(transcript);
      setTranscript('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <Head>
        <title>Servio AI Kitchen Assistant | Interactive Demo</title>
        <meta name="description" content="Experience the future of cooking with AI-powered voice assistance" />
      </Head>

      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur-md border-b border-gray-700/50 p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2">
              <img 
                src="/images/servio_logo_transparent_tight.png" 
                alt="Servio Logo" 
                className="h-10 w-auto"
              />
            </Link>
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-green-600/20 border border-green-500/30 rounded-full">
              <Sparkles className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400 font-medium">Demo Mode</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setVolumeOn(!volumeOn)}
              className={`p-2 rounded-lg transition-colors ${volumeOn ? 'text-green-400 hover:bg-green-600/20' : 'text-gray-500 hover:bg-gray-700'}`}
              title={volumeOn ? 'Mute voice' : 'Unmute voice'}
            >
              {volumeOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <Link
              href="/ai-kitchen-assistant"
              className="flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-300 hover:text-white"
            >
              <span>View Full Page</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row h-[calc(100vh-73px)]">
        {/* Left Panel - Recipe List */}
        <div className="w-full lg:w-80 bg-gray-900/50 border-r border-gray-700/50 flex flex-col">
          <div className="p-4 border-b border-gray-700/50">
            <h2 className="text-lg font-semibold mb-1">AI Kitchen Assistant</h2>
            <p className="text-sm text-gray-400">Select a recipe to begin</p>
          </div>
          
          {/* Category Tabs */}
          <div className="p-3 border-b border-gray-700/50">
            <div className="flex flex-wrap gap-2">
              {RECIPE_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {category.emoji} {category.name}
                </button>
              ))}
            </div>
          </div>
          
          {/* Recipe List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredRecipes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No recipes in this category</p>
              </div>
            ) : (
            filteredRecipes.map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => {
                  // Ask about batch size first
                  setPendingRecipe(recipe);
                  setShowBatchSizePrompt(true);
                  setShowRecipeSelector(false);
                }}
                className={`w-full p-4 rounded-xl text-left transition-all hover:scale-[1.02] ${
                  activeSession?.recipe.id === recipe.id 
                    ? 'bg-gradient-to-r from-green-600/30 to-emerald-600/30 border border-green-500/50' 
                    : 'bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${recipe.color} flex items-center justify-center text-2xl`}>
                    {recipe.image}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{recipe.name}</div>
                    <div className="text-sm text-gray-400 flex items-center space-x-2">
                      <Clock className="w-3 h-3" />
                      <span>{recipe.totalTime} min</span>
                      <span>•</span>
                      <span>{recipe.difficulty}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))
            )}
          </div>

          {/* Quick Commands */}
          <div className="p-4 border-t border-gray-700/50">
            <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Quick Commands</div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_COMMANDS.map((cmd) => (
                <button
                  key={cmd.label}
                  onClick={() => processCommand(cmd.command)}
                  disabled={!activeSession}
                  className="flex items-center justify-center space-x-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
                >
                  <cmd.icon className="w-4 h-4" />
                  <span>{cmd.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Panel - Cooking Interface */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeSession ? (
            <>
              {/* Progress Bar */}
              <div className="bg-gray-900/50 px-6 py-3 border-b border-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${activeSession.recipe.color} flex items-center justify-center text-xl`}>
                      {activeSession.recipe.image}
                    </div>
                    <div>
                      <h2 className="font-semibold">{activeSession.recipe.name}</h2>
                      <div className="text-sm text-gray-400">
                        Step {activeSession.currentStep} of {activeSession.recipe.steps.length}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="text-sm text-gray-400">Servings</div>
                      <div className="font-semibold">{activeSession.scaledServings}</div>
                    </div>
                    <button
                      onClick={() => processCommand('scale')}
                      className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg"
                      title="Scale recipe"
                    >
                      <Scale className="w-5 h-5" />
                    </button>
                    {trainingMode ? (
                      <button
                        onClick={() => processCommand('normal mode')}
                        className="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-sm"
                      >
                        Training
                      </button>
                    ) : (
                      <button
                        onClick={() => processCommand('training')}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm"
                      >
                        Training
                      </button>
                    )}
                  </div>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                    style={{ width: `${(activeSession.currentStep / activeSession.recipe.steps.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Current Step Display */}
              <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                <div className="max-w-3xl mx-auto">
                  {/* Step Card */}
                  <motion.div 
                    key={activeSession.currentStep}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-2xl p-8 mb-6 ${
                      activeSession.status === 'paused' 
                        ? 'bg-yellow-900/20 border-2 border-yellow-500/50' 
                        : 'bg-gray-800/50 border border-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        activeSession.status === 'paused' 
                          ? 'bg-yellow-500/20 text-yellow-400' 
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {activeSession.status === 'paused' ? '⏸️ Paused' : '🔥 Cooking'}
                      </span>
                      <span className="text-gray-400 text-sm">
                        {activeSession.recipe.cuisine} • {activeSession.recipe.difficulty}
                      </span>
                    </div>
                    
                    <h1 className="text-2xl lg:text-3xl font-bold mb-4">
                      {activeSession.recipe.steps[activeSession.currentStep - 1]?.instruction}
                    </h1>

                    {/* Tips (Training Mode) */}
                    {trainingMode && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 mb-4"
                      >
                        <div className="flex items-start space-x-3">
                          <Sparkles className="w-5 h-5 text-blue-400 mt-0.5" />
                          <div>
                            <div className="font-medium text-blue-400 mb-1">💡 Pro Tip</div>
                            <p className="text-gray-300">
                              {activeSession.recipe.steps[activeSession.currentStep - 1]?.tip || 
                               activeSession.recipe.steps[activeSession.currentStep - 1]?.notes || 
                               'Pay attention to this step for best results.'}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Navigation */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-700/50">
                      <button
                        onClick={() => processCommand('previous')}
                        disabled={activeSession.currentStep <= 1}
                        className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                      >
                        <SkipBack className="w-4 h-4" />
                        <span>Previous</span>
                      </button>
                      <button
                        onClick={() => processCommand('next')}
                        className="flex items-center space-x-2 px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
                      >
                        <span>Next Step</span>
                        <SkipForward className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>

                  {/* Timer */}
                  {activeSession.recipe.steps[activeSession.currentStep - 1]?.timer && (
                    <motion.div
                      className={`rounded-2xl p-6 mb-6 text-center ${
                        activeSession.timer && activeSession.timer < 60
                          ? 'bg-red-900/30 border-2 border-red-500 animate-pulse'
                          : activeSession.timerRunning
                          ? 'bg-gray-800/50 border border-green-500/40'
                          : 'bg-gray-800/50 border border-gray-700/50'
                      }`}
                    >
                      <div className="flex items-center justify-center space-x-2 mb-2">
                        <Timer className="w-4 h-4 text-gray-400" />
                        <div className="text-sm text-gray-400">Step Timer</div>
                        {activeSession.timerRunning && (
                          <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">Running</span>
                        )}
                      </div>
                      <div className={`text-5xl font-bold mb-4 font-mono ${
                        activeSession.timer && activeSession.timer < 60 ? 'text-red-400' : 'text-white'
                      }`}>
                        {activeSession.timer !== null ? formatTime(activeSession.timer) :
                          formatTime(activeSession.recipe.steps[activeSession.currentStep - 1].timer || 0)}
                      </div>
                      <div className="flex items-center justify-center space-x-3">
                        {!activeSession.timerRunning ? (
                          <button
                            onClick={() => processCommand('start timer')}
                            className="flex items-center space-x-2 px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
                          >
                            <Play className="w-5 h-5" />
                            <span>Start Timer</span>
                          </button>
                        ) : activeSession.status === 'paused' ? (
                          <button
                            onClick={() => processCommand('resume')}
                            className="flex items-center space-x-2 px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
                          >
                            <Play className="w-5 h-5" />
                            <span>Resume</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => processCommand('pause')}
                            className="flex items-center space-x-2 px-6 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-medium transition-colors"
                          >
                            <Pause className="w-5 h-5" />
                            <span>Pause</span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Ingredients Toggle */}
                  <button
                    onClick={() => setShowIngredients(!showIngredients)}
                    className="w-full flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-800 rounded-xl border border-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <ListChecks className="w-5 h-5 text-green-400" />
                      <span>Ingredients ({activeSession.recipe.ingredients.length})</span>
                    </div>
                    <span className={`transform transition-transform ${showIngredients ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </button>

                  {/* Ingredients List */}
                  <AnimatePresence>
                    {showIngredients && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-gray-800/30 border border-gray-700/50 rounded-xl mt-2 overflow-hidden"
                      >
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                          {activeSession.recipe.ingredients.map((ing, i) => {
                            const scaleFactor = activeSession.scaledServings / activeSession.recipe.servings;
                            const scaledAmount = Math.round(ing.amount * scaleFactor * 10) / 10;
                            return (
                              <div key={i} className="flex items-center space-x-2 text-gray-300">
                                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                <span><span className="font-medium">{scaledAmount} {ing.unit}</span> {ing.name}</span>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Steps Overview */}
                  <div className="mt-4">
                    <button
                      onClick={() => setShowTips(!showTips)}
                      className="w-full flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-800 rounded-xl border border-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <BookOpen className="w-5 h-5 text-blue-400" />
                        <span>All Steps ({activeSession.recipe.steps.length})</span>
                        <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">
                          {activeSession.completedSteps.length} done
                        </span>
                      </div>
                      <span className={`transform transition-transform ${showTips ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </button>
                    <AnimatePresence>
                      {showTips && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-gray-800/30 border border-gray-700/50 rounded-xl mt-2 overflow-hidden"
                        >
                          <div className="p-4 space-y-2">
                            {activeSession.recipe.steps.map((step) => {
                              const isCompleted = activeSession.completedSteps.includes(step.number);
                              const isCurrent = step.number === activeSession.currentStep;
                              return (
                                <button
                                  key={step.number}
                                  onClick={() => {
                                    const targetStep = activeSession.recipe.steps[step.number - 1];
                                    setActiveSession({
                                      ...activeSession,
                                      currentStep: step.number,
                                      timer: targetStep.timer,
                                      timerRunning: false,
                                    });
                                  }}
                                  className={`w-full flex items-start space-x-3 p-3 rounded-lg text-left transition-colors ${
                                    isCurrent
                                      ? 'bg-green-600/20 border border-green-500/40'
                                      : isCompleted
                                      ? 'bg-gray-700/30 opacity-70'
                                      : 'hover:bg-gray-700/30'
                                  }`}
                                >
                                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${
                                    isCompleted
                                      ? 'bg-green-600 text-white'
                                      : isCurrent
                                      ? 'bg-green-500 text-white ring-2 ring-green-400/50'
                                      : 'bg-gray-700 text-gray-400'
                                  }`}>
                                    {isCompleted ? '✓' : step.number}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm ${isCurrent ? 'text-white font-medium' : isCompleted ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                                      {step.instruction}
                                    </p>
                                    {step.timer && (
                                      <span className="text-xs text-blue-400 flex items-center space-x-1 mt-0.5">
                                        <Clock className="w-3 h-3" />
                                        <span>{Math.floor(step.timer / 60)} min</span>
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* No Active Session - Welcome */
            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
              <div className="max-w-3xl mx-auto">
                <div className="text-center mb-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center"
                  >
                    <ChefHat className="w-12 h-12 text-white" />
                  </motion.div>
                  <h2 className="text-3xl font-bold mb-3">
                    AI Kitchen Assistant
                  </h2>
                  <p className="text-gray-400 text-lg">
                    Voice-controlled step-by-step cooking guidance for professional kitchens.
                    <br />Select a recipe from the sidebar or click one below to get started.
                  </p>
                </div>

                {!speechSupported && (
                  <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4 mb-6">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium text-yellow-400">Voice Recognition Unavailable</div>
                        <div className="text-sm text-gray-300">
                          Voice recognition works best in Chrome or Edge. You can still use the text input and quick command buttons below.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Featured Recipes Grid */}
                <div className="mb-8">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Featured Recipes</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {DEMO_RECIPES.slice(0, 4).map((recipe) => (
                      <motion.button
                        key={recipe.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => {
                          setPendingRecipe(recipe);
                          setShowBatchSizePrompt(true);
                        }}
                        className="text-left p-5 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 rounded-2xl transition-all"
                      >
                        <div className="flex items-center space-x-4 mb-3">
                          <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${recipe.color} flex items-center justify-center text-3xl`}>
                            {recipe.image}
                          </div>
                          <div>
                            <div className="font-semibold text-lg">{recipe.name}</div>
                            <div className="text-sm text-gray-400">{recipe.cuisine} • {recipe.difficulty}</div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-400 mb-3">{recipe.description}</p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{recipe.totalTime} min</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <Users className="w-3 h-3" />
                            <span>{recipe.servings} servings</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <BookOpen className="w-3 h-3" />
                            <span>{recipe.steps.length} steps</span>
                          </span>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Feature Highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { icon: Mic, color: 'text-green-400', bg: 'bg-green-400/10', title: 'Voice Commands', desc: 'Hands-free control while cooking. Say "next step", "show ingredients", or "pause".' },
                    { icon: Timer, color: 'text-blue-400', bg: 'bg-blue-400/10', title: 'Smart Timers', desc: 'Automatic step timers with visual countdowns and audio alerts.' },
                    { icon: Scale, color: 'text-purple-400', bg: 'bg-purple-400/10', title: 'Recipe Scaling', desc: 'Instantly scale recipes to any batch size with automatic quantity adjustment.' },
                  ].map((feature) => (
                    <div key={feature.title} className="p-4 bg-gray-800/30 border border-gray-700/30 rounded-xl">
                      <div className={`w-10 h-10 ${feature.bg} rounded-lg flex items-center justify-center mb-3`}>
                        <feature.icon className={`w-5 h-5 ${feature.color}`} />
                      </div>
                      <div className="font-medium mb-1">{feature.title}</div>
                      <div className="text-sm text-gray-400">{feature.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Voice Input Area */}
          <div className="p-4 lg:p-6 bg-gray-900/80 border-t border-gray-700/50">
            <div className="max-w-3xl mx-auto">
              {/* Voice Wave Visualization */}
              <AnimatePresence>
                {isListening && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center justify-center space-x-1 mb-4 h-8"
                  >
                    {[...Array(12)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-1 bg-green-500 rounded-full"
                        animate={{
                          height: [8, Math.random() * 32 + 8, 8],
                        }}
                        transition={{
                          duration: 0.5,
                          repeat: Infinity,
                          delay: i * 0.05,
                        }}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleCommandSubmit} className="flex items-center space-x-3">
                {/* Mic Button */}
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                    isListening 
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isListening ? (
                    <MicOff className="w-6 h-6" />
                  ) : (
                    <Mic className="w-6 h-6" />
                  )}
                </button>

                {/* Input Field */}
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder={isListening ? "Listening..." : "Type a command or click mic to speak..."}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  {transcript && (
                    <button
                      type="button"
                      onClick={() => setTranscript('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!transcript.trim()}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
                >
                  Send
                </button>
              </form>

              {/* AI Response */}
              <AnimatePresence>
                {aiResponse && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50"
                  >
                    <div className="flex items-start space-x-3">
                      <MessageCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <p className="text-gray-200 whitespace-pre-wrap">{aiResponse}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Batch Size Prompt Modal */}
      {showBatchSizePrompt && pendingRecipe && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border border-gray-700"
          >
            <div className="text-center mb-6">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br ${pendingRecipe.color} flex items-center justify-center text-4xl`}>
                {pendingRecipe.image}
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {pendingRecipe.name}
              </h2>
              <p className="text-gray-400">
                How many people are you feeding?
              </p>
            </div>

            {/* Batch Size Options */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[10, 20, 50].map((size) => (
                <button
                  key={size}
                  onClick={() => startRecipeWithBatchSize(size)}
                  className="p-4 bg-gray-700 hover:bg-green-600 rounded-xl transition-colors text-center"
                >
                  <div className="text-2xl font-bold text-white">{size}</div>
                  <div className="text-sm text-gray-400">people</div>
                </button>
              ))}
            </div>

            {/* Custom Input */}
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">Or enter custom amount:</label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  id="customServings"
                  min="1"
                  max="500"
                  placeholder="e.g., 75"
                  className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const value = parseInt((e.target as HTMLInputElement).value);
                      if (value > 0) {
                        startRecipeWithBatchSize(value);
                      }
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.getElementById('customServings') as HTMLInputElement;
                    const value = parseInt(input.value);
                    if (value > 0) {
                      startRecipeWithBatchSize(value);
                    }
                  }}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors"
                >
                  Start
                </button>
              </div>
            </div>

            {/* Cancel Button */}
            <button
              onClick={() => {
                setShowBatchSizePrompt(false);
                setPendingRecipe(null);
              }}
              className="w-full py-3 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
