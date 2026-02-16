// Supabase Edge Function: log_meal
// POST /log_food
// Input: { user_id (email), date, meal_type, calories, protein } (required) + optional fields
// Response: created meal log
// Note: user_id must be a valid email and references users.user_id table
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { 
      status: 405,
      headers: corsHeaders 
    });
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON in request body' 
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }      });
    }    // Validate required fields: date, meal_type, user_id (email), protein, calories
    const { user_id, meal_type, date, calories, protein, description, fat_g, carbs_g } = body;
    
    if (!user_id || typeof user_id !== 'string') {
      return new Response(JSON.stringify({ error: 'user_id is required' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
      // Validate email format for user_id (since it's a foreign key to users.user_id)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(user_id)) {
      return new Response(JSON.stringify({ 
        error: 'user_id must be a valid email address' 
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Normalize email to lowercase for case-insensitive matching
    const normalizedEmail = user_id.toLowerCase().trim();
    
    const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    if (!meal_type || !validMealTypes.includes(meal_type)) {
      return new Response(JSON.stringify({ 
        error: `meal_type is required and must be one of: ${validMealTypes.join(', ')}` 
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (!date || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
      return new Response(JSON.stringify({ 
        error: 'date is required and must be in YYYY-MM-DD format' 
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (typeof calories !== 'number' || calories < 0) {
      return new Response(JSON.stringify({
        error: 'calories is required and must be a non-negative number' 
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (typeof protein !== 'number' || protein < 0) {
      return new Response(JSON.stringify({
        error: 'protein is required and must be a non-negative number' 
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }      });
    }

    // Get Supabase URL and key from environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);    // Ensure the user exists in the users table (since user_id is a foreign key)
    const { data: existingUser } = await supabase
      .from('users')
      .select('user_id')
      .eq('user_id', user_id)
      .single();

    if (!existingUser) {
      // Create user if they don't exist (to satisfy foreign key constraint)
      const { error: userError } = await supabase
        .from('users')
        .insert([{ 
          user_id: user_id,
          created_at: new Date().toISOString()
        }]);

      if (userError) {
        console.error('Error creating user:', userError);
        return new Response(JSON.stringify({ 
          error: 'Failed to create user account',
          details: userError.message 
        }), { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }    // Insert meal log using normalized user_id
    const { data, error } = await supabase
      .from('meal_logs')
      .insert({
        user_id: normalizedEmail,
        meal_type: meal_type,
        meal_date: date,
        description: description || null,
        calories: calories,
        protein_g: protein,
        fat_g: fat_g || 0,
        carbs_g: carbs_g || 0,
        logged_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to log meal',
        details: error.message 
      }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      data: data,
      message: 'Meal logged successfully' 
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
