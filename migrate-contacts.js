import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/hostels?|apartments?|blocks?|suites?|residence|ladies|gents|ltd/gi, '')
    .trim();
}

function wordsMatch(a, b) {
  const aw = a.split(' ').filter(x => x.length > 2);
  const bw = b.split(' ').filter(x => x.length > 2);
  if (aw.length === 0 || bw.length === 0) return false;
  return aw.every(w => bw.includes(w)) || bw.every(w => aw.includes(w));
}

async function run() {
  const csvText = fs.readFileSync(path.join(process.cwd(), 'dekut-hostel-owner-contacts.csv'), 'utf8');
  const lines = csvText.split('\n').filter(l => l.trim().length > 0);
  
  const dekutContacts = lines.slice(1).map(line => {
    const [source_no, hostel_name, phone_1, phone_2, contact_type, contact_person, zone, flag] = line.split(',');
    return {
      source_no, hostel_name, phone_1, phone_2, contact_type, contact_person, zone, flag,
      normalized: normalizeName(hostel_name)
    };
  });

  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, title, landlord_phone, agents(whatsapp, phone)');

  let matchedCount = 0;
  let fallbackCount = 0;
  let ambiguousCount = 0;

  // Custom overrides from RUMIA MATCH REFERENCE
  const overrides = {
    'kimathi student centre hostel(greens)': 'kimathi students centre',
    'urban suites': 'urban suits',
    'delanova': 'de-la-nova',
    'lolan scholars hub': 'lolan hub scholars',
    'mimshack': 'mimshack',
    'edge view': 'edgeview',
    'new tamaal': 'tamaal',
    'old tamaal': 'tamaal'
  };

  for (const listing of listings) {
    const originalTitle = listing.title;
    const lowerTitle = originalTitle.toLowerCase().trim();
    const agentPhone = listing.agents?.whatsapp || listing.agents?.phone || null;

    let targetPhone = null;

    if (lowerTitle.includes('sunrise')) {
      ambiguousCount++;
      targetPhone = agentPhone;
      console.log(`[AMBIGUOUS] ${originalTitle} -> defaulted to agent ${targetPhone}`);
    } else {
      let match = null;
      
      // Override
      let overrideKey = Object.keys(overrides).find(k => lowerTitle.includes(k));
      if (overrideKey) {
        let overName = overrides[overrideKey];
        match = dekutContacts.find(c => c.normalized.includes(overName));
      }

      if (!match) {
        const listingNorm = normalizeName(originalTitle);
        match = dekutContacts.find(c => c.normalized === listingNorm);
        if (!match) {
           match = dekutContacts.find(c => wordsMatch(c.normalized, listingNorm));
        }
      }
      
      if (match) {
        if (match.flag && match.flag.includes('NOT A LANDLORD')) {
          console.log(`[SKIP - AGENT] ${originalTitle} matches ${match.hostel_name} but is labeled NOT A LANDLORD`);
          targetPhone = agentPhone;
          fallbackCount++;
        } else {
          targetPhone = match.phone_1;
          matchedCount++;
          console.log(`[MATCH] ${originalTitle} -> ${match.hostel_name} (${targetPhone})`);
        }
      } else {
        targetPhone = agentPhone;
        fallbackCount++;
        console.log(`[NO MATCH] ${originalTitle} -> defaulted to agent ${targetPhone}`);
      }
    }

    if (targetPhone) {
      await supabase.from('listings').update({ landlord_phone: targetPhone }).eq('id', listing.id);
    }
  }

  console.log('\n--- REPORT ---');
  console.log(`Total listings: ${listings.length}`);
  console.log(`Matched (real owner number): ${matchedCount}`);
  console.log(`Fallback (agent number): ${fallbackCount}`);
  console.log(`Ambiguous (Sunrise): ${ambiguousCount}`);
}

run();
