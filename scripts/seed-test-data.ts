import { createClient } from '@supabase/supabase-js';

// Use environment variables or pass them directly if running outside Next.js
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  console.error("Please add SUPABASE_SERVICE_ROLE_KEY to your .env.local file. You can find it in your Supabase project settings -> API.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function seed() {
  console.log('🌱 Starting database seed...');

  const testAgents = [
    {
      email: 'agent1@rumia.co.ke',
      password: 'password123',
      name: 'Test Agent One',
      phone: '+254700000001',
    },
    {
      email: 'agent2@rumia.co.ke',
      password: 'password123',
      name: 'Test Agent Two',
      phone: '+254700000002',
    },
  ];

  for (const agentInfo of testAgents) {
    console.log(`\nProcessing test agent: ${agentInfo.email}`);

    // 1. Create or get user in Supabase Auth
    let userId;
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      continue;
    }

    const existingUser = users.users.find(u => u.email === agentInfo.email);
    
    if (existingUser) {
      console.log(`User ${agentInfo.email} already exists in Auth. ID: ${existingUser.id}`);
      userId = existingUser.id;
    } else {
      console.log(`Creating user ${agentInfo.email} in Auth...`);
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: agentInfo.email,
        password: agentInfo.password,
        email_confirm: true,
      });

      if (authError || !authData.user) {
        console.error('Failed to create auth user:', authError);
        continue;
      }
      userId = authData.user.id;
      console.log(`Created user with ID: ${userId}`);
    }

    // 2. Ensure agent profile exists
    const { data: existingAgent } = await supabase
      .from('agents')
      .select('id')
      .eq('user_id', userId)
      .single();

    let agentId;

    if (existingAgent) {
      console.log(`Agent profile already exists. Agent ID: ${existingAgent.id}`);
      agentId = existingAgent.id;
    } else {
      console.log(`Creating agent profile...`);
      const { data: agentData, error: agentError } = await supabase
        .from('agents')
        .insert({
          user_id: userId,
          name: agentInfo.name,
          phone: agentInfo.phone,
          whatsapp: agentInfo.phone,
          commission_balance: 0,
        })
        .select()
        .single();

      if (agentError) {
        console.error('Failed to create agent profile:', agentError);
        continue;
      }
      agentId = agentData.id;
      console.log(`Created agent profile with ID: ${agentId}`);
    }

    // 3. Insert mock listings for this agent (only if they have no listings)
    const { data: existingListings } = await supabase
      .from('listings')
      .select('id')
      .eq('agent_id', agentId);

    if (existingListings && existingListings.length > 0) {
      console.log(`Agent already has ${existingListings.length} listings. Skipping listing creation.`);
    } else {
      console.log(`Creating test listing for agent...`);
      const { data: newListing, error: listingError } = await supabase
        .from('listings')
        .insert({
          title: `Premium Test Hostel by ${agentInfo.name}`,
          description: 'This is a test listing generated for localhost testing. It includes spacious rooms, stable internet, and close proximity to campus.',
          price: 15000,
          location: 'Juja, Gate C',
          agent_id: agentId,
          is_active: true,
          landlord_phone: agentInfo.phone,
          room_type: 'Self-Contained',
          amenities: ['WiFi', 'Water', 'Security'],
          bathroom_type: 'Private',
          distance_to_campus: '5 mins walk',
          security_type: 'CCTV & Guard',
          electricity_included: true,
          water_included: true,
          wifi_included: true,
          latitude: -0.3975,
          longitude: 36.9615,
        })
        .select()
        .single();

      if (listingError) {
        console.error('Failed to create listing:', listingError);
      } else {
        console.log(`Created test listing with ID: ${newListing.id}`);
        
        // Add a mock image
        await supabase
          .from('listing_images')
          .insert({
            listing_id: newListing.id,
            r2_url: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600',
            display_order: 0,
            category: 'Room'
          });
          
        // Add room type
        await supabase
          .from('listing_room_types')
          .insert({
            listing_id: newListing.id,
            room_type: 'Self-Contained',
            price: 15000,
            is_available: true
          });
          
        console.log(`Added test images and room types for listing.`);
      }
    }
  }

  console.log('\n✅ Database seed completed successfully!');
  console.log('You can now log in to the dashboard using:');
  console.log('Email: agent1@rumia.co.ke');
  console.log('Password: password123');
}

seed().catch(console.error);
