// Servio AI Kitchen Assistant - Demo Version
// Interactive demo for testing voice cooking assistant

import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
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
  Utensils,
  Timer,
  Flame
} from 'lucide-react';

// Demo recipes
const DEMO_RECIPES = [
  {
    id: 1,
    name: 'Jerk Chicken',
    difficulty: 'Medium',
    time: '75 min',
    servings: 20,
    steps: [
      { number: 1, instruction: 'Wash and clean the chicken pieces thoroughly', timer: null },
      { number: 2, instruction: 'Pat dry with paper towels', timer: null },
      { number: 3, instruction: 'Mix all dry spices in a bowl: salt, garlic powder, onion powder, thyme, allspice, cayenne, paprika, and brown sugar', timer: null },
      { number: 4, instruction: 'Add soy sauce, vegetable oil, and lime juice to the spice mix to form a paste', timer: null },
      { number: 5, instruction: 'Coat chicken pieces evenly with the jerk marinade', timer: null },
      { number: 6, instruction: 'Marinate chicken in the refrigerator', timer: 7200 },
      { number: 7, instruction: 'Preheat oven to 375°F (190°C)', timer: null },
      { number: 8, instruction: 'Place chicken on a baking sheet or grill', timer: 1500 },
      { number: 9, instruction: 'Flip chicken halfway through cooking', timer: null },
      { number: 10, instruction: 'Check internal temperature reaches 165°F (74°C)', timer: null },
      { number: 11, instruction: 'Let rest for 5 minutes before serving', timer: 300 }
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
    difficulty: 'Easy',
    time: '50 min',
    servings: 20,
    steps: [
      { number: 1, instruction: 'Rinse rice thoroughly until water runs clear', timer: null },
      { number: 2, instruction: 'Drain kidney beans and set aside', timer: null },
      { number: 3, instruction: 'In a large pot, combine coconut milk, kidney beans, scotch bonnet peppers, garlic, thyme, and salt', timer: null },
      { number: 4, instruction: 'Bring to a boil over high heat', timer: null },
      { number: 5, instruction: 'Add rice and stir well', timer: null },
      { number: 6, instruction: 'Reduce heat to low, cover tightly', timer: 1800 },
      { number: 7, instruction: 'Cook until rice is tender and liquid is absorbed', timer: null },
      { number: 8, instruction: 'Remove scotch bonnet peppers, add butter and fluff with fork', timer: null }
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
    difficulty: 'Medium',
    time: '165 min',
    servings: 15,
    steps: [
      { number: 1, instruction: 'Cut goat meat into 2-inch cubes and wash thoroughly', timer: null },
      { number: 2, instruction: 'Pat meat dry with paper towels', timer: null },
      { number: 3, instruction: 'Season with curry powder, salt, and half the thyme', timer: null },
      { number: 4, instruction: 'Heat oil in a large pot over high heat', timer: null },
      { number: 5, instruction: 'Brown goat meat in batches, about 3-4 minutes per side', timer: 1200 },
      { number: 6, instruction: 'Remove meat and sauté onions until softened', timer: 300 },
      { number: 7, instruction: 'Add garlic, ginger, and tomatoes, cook for 2 minutes', timer: 120 },
      { number: 8, instruction: 'Return meat to pot, add remaining thyme and scotch bonnet', timer: null },
      { number: 9, instruction: 'Add coconut milk and bring to a boil', timer: null },
      { number: 10, instruction: 'Reduce heat, cover and simmer until meat is tender', timer: 5400 },
      { number: 11, instruction: 'Add potatoes and cook until tender', timer: 1200 },
      { number: 12, instruction: 'Adjust seasoning and serve hot', timer: null }
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
  }
];

interface ActiveSession {
  recipe: typeof DEMO_RECIPES[0];
  currentStep: number;
  status: 'active' | 'paused' | 'completed';
  timer: number | null;
  timerRunning: boolean;
  scaledServings: number;
}

export default function KitchenAssistantDemo() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [showRecipeSelector, setShowRecipeSelector] = useState(false);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [showIngredients, setShowIngredients] = useState(false);
  const [trainingMode, setTrainingMode] = useState(false);
  const [volumeOn, setVolumeOn] = useState(true);
  const [history, setHistory] = useState<{ type: 'user' | 'ai'; text: string }[]>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Process voice command (simulated)
  const processCommand = (text: string) => {
    const lowerText = text.toLowerCase();
    let response = '';

    // Add to history
    setHistory(prev => [...prev, { type: 'user', text }]);

    // Start recipe
    if (lowerText.includes('start') || lowerText.includes('begin')) {
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
          scaledServings: recipeName.servings
        });
        response = `Starting ${recipeName.name}. Batch size: ${recipeName.servings} servings. Step 1: ${step.instruction}${step.timer ? `. This step takes ${Math.floor(step.timer / 60)} minutes.` : ''}. Tell me when you're ready for the next step.`;
      } else {
        response = `I couldn't find that recipe. Available recipes are: ${DEMO_RECIPES.map(r => r.name).join(', ')}.`;
      }
    }
    // Next step
    else if (lowerText.includes('next')) {
      if (!activeSession) {
        response = 'No active recipe. Please start a recipe first.';
      } else {
        const nextStepNum = activeSession.currentStep + 1;
        if (nextStepNum > activeSession.recipe.steps.length) {
          response = `Congratulations! You have completed ${activeSession.recipe.name}. Great job!`;
          setActiveSession({ ...activeSession, status: 'completed' });
        } else {
          const nextStep = activeSession.recipe.steps[nextStepNum - 1];
          setActiveSession({
            ...activeSession,
            currentStep: nextStepNum,
            timer: nextStep.timer,
            timerRunning: false
          });
          response = trainingMode 
            ? `Step ${nextStepNum}: ${nextStep.instruction}. ${(nextStep as any).notes || 'This step is important for the final dish quality.'} Tell me when ready for next step.`
            : `Step ${nextStepNum}: ${nextStep.instruction}${nextStep.timer ? `. This step takes ${Math.floor(nextStep.timer / 60)} minutes.` : ''}`;
        }
      }
    }
    // Previous step
    else if (lowerText.includes('previous') || lowerText.includes('go back')) {
      if (!activeSession) {
        response = 'No active recipe.';
      } else if (activeSession.currentStep <= 1) {
        response = 'You are already at the first step.';
      } else {
        const prevStepNum = activeSession.currentStep - 1;
        const prevStep = activeSession.recipe.steps[prevStepNum - 1];
        setActiveSession({
          ...activeSession,
          currentStep: prevStepNum,
          timer: prevStep.timer,
          timerRunning: false
        });
        response = `Step ${prevStepNum}: ${prevStep.instruction}`;
      }
    }
    // Repeat
    else if (lowerText.includes('repeat') || lowerText.includes('say again')) {
      if (!activeSession) {
        response = 'No active recipe.';
      } else {
        const currentStep = activeSession.recipe.steps[activeSession.currentStep - 1];
        response = `Step ${activeSession.currentStep}: ${currentStep.instruction}`;
      }
    }
    // Show ingredients
    else if (lowerText.includes('ingredient')) {
      if (!activeSession) {
        response = 'Start a recipe first to see ingredients.';
      } else {
        const ingredients = activeSession.recipe.ingredients
          .map(i => `${i.amount} ${i.unit} ${i.name}`)
          .join(', ');
        response = `Ingredients for ${activeSession.recipe.name}: ${ingredients}`;
      }
    }
    // Scale recipe
    else if (lowerText.includes('scale')) {
      const servingsMatch = lowerText.match(/(\d+)\s*(servings?|portions?)/);
      if (!activeSession) {
        response = 'Start a recipe first to scale it.';
      } else if (!servingsMatch) {
        response = 'How many servings would you like to scale to? For example: "Scale to 40 servings"';
      } else {
        const newServings = parseInt(servingsMatch[1]);
        setActiveSession({ ...activeSession, scaledServings: newServings });
        response = `Recipe scaled to ${newServings} servings. All ingredient quantities have been adjusted.`;
      }
    }
    // Training mode
    else if (lowerText.includes('training')) {
      setTrainingMode(true);
      if (activeSession) {
        const currentStep = activeSession.recipe.steps[activeSession.currentStep - 1];
        response = `Training mode enabled. Step ${activeSession.currentStep}: ${currentStep.instruction}. ${(currentStep as any).notes || 'Pay close attention to this step as it affects the final dish quality.'}`;
      } else {
        response = 'Training mode enabled. Start a recipe to begin training.';
      }
    }
    // Stop
    else if (lowerText.includes('stop') || lowerText.includes('done')) {
      if (activeSession) {
        setActiveSession(null);
        response = 'Cooking session ended. Thank you for using Servio AI Kitchen Assistant!';
      } else {
        response = 'No active cooking session to stop.';
      }
    }
    // Pause
    else if (lowerText.includes('pause') || lowerText.includes('hold')) {
      if (activeSession) {
        setActiveSession({ ...activeSession, status: 'paused', timerRunning: false });
        response = 'Cooking paused. Say "resume" to continue.';
      } else {
        response = 'No active cooking session to pause.';
      }
    }
    // Resume
    else if (lowerText.includes('resume') || lowerText.includes('continue')) {
      if (activeSession && activeSession.status === 'paused') {
        setActiveSession({ ...activeSession, status: 'active', timerRunning: true });
        response = 'Cooking resumed. Continuing from where we left off.';
      } else {
        response = 'No paused cooking session to resume.';
      }
    }
    // Check timer
    else if (lowerText.includes('timer') || lowerText.includes('how long')) {
      if (activeSession?.timer) {
        response = `Timer shows ${formatTime(activeSession.timer)} remaining.`;
      } else {
        response = 'No timer is currently running for this step.';
      }
    }
    // Default
    else {
      response = "I didn't understand that. Try saying 'Start jerk chicken', 'Next step', or 'Show ingredients'.";
    }

    // Simulate AI delay
    setTimeout(() => {
      setAiResponse(response);
      setHistory(prev => [...prev, { type: 'ai', text: response }]);
    }, 500);
  };

  // Handle voice input
  const handleVoiceInput = () => {
    if (isListening) {
      setIsListening(false);
      if (transcript.trim()) {
        processCommand(transcript);
      }
      setTranscript('');
    } else {
      setIsListening(true);
      // Simulate speech recognition
      setTimeout(() => {
        setTranscript('Start jerk chicken');
      }, 1000);
    }
  };

  // Simulate typing effect
  useEffect(() => {
    if (isListening && transcript.length < 20) {
      const timeout = setTimeout(() => {
        const commands = [
          'Start jerk chicken',
          'Next step',
          'Show ingredients',
          'Scale to 40 servings',
          'Repeat step',
          'Pause',
          'Resume'
        ];
        setTranscript(commands[Math.floor(Math.random() * commands.length)]);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [isListening, transcript]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Head>
        <title>Servio AI Kitchen Assistant | Interactive Demo</title>
      </Head>

      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center">
                <Utensils className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold">Servio</span>
            </Link>
            <span className="px-3 py-1 bg-green-600/20 text-green-400 text-sm rounded-full">
              Demo Mode
            </span>
          </div>
          <Link
            href="/ai-kitchen-assistant"
            className="text-gray-400 hover:text-white transition-colors"
          >
            View Full Page →
          </Link>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Panel - Active Recipe */}
        <div className="w-1/3 bg-gray-800 border-r border-gray-700 flex flex-col">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-lg font-semibold mb-4">Active Recipes</h2>
            
            {!activeSession ? (
              <div className="text-center py-8">
                <ChefHat className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 mb-4">No active recipes</p>
                <button
                  onClick={() => setShowRecipeSelector(true)}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
                >
                  + Start Recipe
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${activeSession.status === 'paused' ? 'bg-yellow-900/30 border border-yellow-700' : 'bg-green-900/30 border border-green-700'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">{activeSession.recipe.name}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      activeSession.status === 'active' 
                        ? 'bg-green-600' 
                        : activeSession.status === 'paused'
                        ? 'bg-yellow-600'
                        : 'bg-gray-600'
                    }`}>
                      {activeSession.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 mb-3">
                    Step {activeSession.currentStep}: {activeSession.recipe.steps[activeSession.currentStep - 1]?.instruction.substring(0, 50)}...
                  </p>
                  {activeSession.timer && (
                    <div className="flex items-center text-sm text-green-400">
                      <Timer className="w-4 h-4 mr-1" />
                      {formatTime(activeSession.timer)}
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => processCommand('next')}
                    className="py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => processCommand('repeat')}
                    className="py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    Repeat
                  </button>
                  <button
                    onClick={() => setShowIngredients(true)}
                    className="py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    Ingredients
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Recipe List */}
          <div className="flex-1 overflow-y-auto p-6">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Available Recipes</h3>
            <div className="space-y-2">
              {DEMO_RECIPES.map((recipe) => (
                <button
                  key={recipe.id}
                  onClick={() => {
                    setActiveSession({
                      recipe,
                      currentStep: 1,
                      status: 'active',
                      timer: recipe.steps[0].timer,
                      timerRunning: false,
                      scaledServings: recipe.servings
                    });
                    processCommand(`start ${recipe.name}`);
                  }}
                  className="w-full p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors"
                >
                  <div className="font-medium">{recipe.name}</div>
                  <div className="text-sm text-gray-400">
                    {recipe.time} • {recipe.difficulty}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Panel - Current Step */}
        <div className="flex-1 flex flex-col">
          {activeSession ? (
            <>
              <div className="flex-1 p-8 flex flex-col justify-center items-center max-w-3xl mx-auto w-full">
                <div className="text-green-400 font-medium mb-2">
                  {activeSession.recipe.name} • Step {activeSession.currentStep} of {activeSession.recipe.steps.length}
                </div>
                
                <h1 className="text-4xl font-bold text-center mb-8">
                  {activeSession.recipe.steps[activeSession.currentStep - 1]?.instruction}
                </h1>

                {/* Timer Display */}
                {activeSession.timer && (
                  <div className={`text-center p-12 rounded-3xl mb-8 ${
                    activeSession.timer < 60 
                      ? 'bg-red-500 animate-pulse' 
                      : activeSession.status === 'paused'
                      ? 'bg-yellow-600'
                      : 'bg-green-600'
                  }`}>
                    <div className="text-7xl font-bold mb-2">
                      {formatTime(activeSession.timer)}
                    </div>
                    <div className="text-white/80">
                      {activeSession.status === 'paused' ? 'Paused' : 'Cooking...'}
                    </div>
                    <div className="flex gap-4 mt-6 justify-center">
                      {activeSession.status === 'paused' ? (
                        <button
                          onClick={() => processCommand('resume')}
                          className="px-6 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium"
                        >
                          Resume
                        </button>
                      ) : (
                        <button
                          onClick={() => processCommand('pause')}
                          className="px-6 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium"
                        >
                          Pause
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Ingredients */}
                {showIngredients && (
                  <div className="w-full bg-gray-800 rounded-xl p-6 mb-8">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-semibold">Ingredients</h3>
                      <button onClick={() => setShowIngredients(false)}>
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {activeSession.recipe.ingredients.map((ing, i) => (
                        <div key={i} className="text-gray-300">
                          {ing.amount} {ing.unit} {ing.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center">
                  <Volume2 className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  Welcome to AI Kitchen Assistant
                </h3>
                <p className="text-gray-400 mb-6">
                  Select a recipe to start cooking or tap the microphone to speak
                </p>
              </div>
            </div>
          )}

          {/* Voice Input */}
          <div className="p-6 bg-gray-800 border-t border-gray-700">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={() => setVolumeOn(!volumeOn)}
                  className={`p-2 rounded-lg ${volumeOn ? 'text-green-400' : 'text-gray-500'}`}
                >
                  {volumeOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                </button>
                
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && transcript.trim()) {
                        processCommand(transcript);
                        setTranscript('');
                      }
                    }}
                    placeholder="Type a command or tap the microphone..."
                    className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:border-green-500"
                  />
                  <button
                    onClick={handleVoiceInput}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors ${
                      isListening 
                        ? 'bg-red-500 text-white animate-pulse' 
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Response */}
              {aiResponse && (
                <div className="bg-green-900/30 border border-green-700 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <ChefHat className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="font-medium text-green-400 mb-1">Servio AI</div>
                      <div className="text-white">{aiResponse}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recipe Selector Modal */}
      {showRecipeSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Select a Recipe</h2>
              <button onClick={() => setShowRecipeSelector(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-3">
              {DEMO_RECIPES.map((recipe) => (
                <button
                  key={recipe.id}
                  onClick={() => {
                    processCommand(`start ${recipe.name}`);
                    setShowRecipeSelector(false);
                  }}
                  className="w-full p-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors"
                >
                  <div className="font-semibold">{recipe.name}</div>
                  <div className="text-sm text-gray-400">
                    {recipe.time} • {recipe.difficulty} • {recipe.servings} servings
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
