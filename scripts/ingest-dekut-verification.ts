import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import {
  parseOfficialRecord,
  matchOfficialRecordToListing,
  normalizePhone,
} from '../src/lib/utils/dekut-verification';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const officialRecords = [
  {
    hostel_name: 'Sunrise Hostel Block CD',
    contacts: '0703753641',
    payments: 'Till: 9383225',
  },
  {
    hostel_name: 'Sunrise Hostel Block AB',
    contacts: '0116891682',
    payments: 'Paybill 100400, A/C Sun#(Room No.)',
  },
  {
    hostel_name: 'Kimathi Students Centre',
    contacts: '0100492929, 0707862475',
    payments: 'Paybill 452452 A/C 852880; Paybill 111999 A/C 38972',
  },
  {
    hostel_name: 'La Duvet Hostel',
    contacts: '0718862632',
    payments: 'Paybill 584850',
  },
  {
    hostel_name: 'Maisha Hostels',
    contacts: '0745409929',
    payments: 'Paybill 400222',
  },
  {
    hostel_name: 'Mimshack Students Residence',
    contacts: '0724693216',
    payments: 'Paybill 500006, A/No. BA100060490AP',
  },
  {
    hostel_name: 'DE-LA-NOVA Apartment',
    contacts: '0722305973',
    payments: 'Paybill 522533 A/C 7887516',
  },
  {
    hostel_name: 'TAKIMU Apartment',
    contacts: '0718921088',
    payments: 'Paybill 460871 A/C EA014',
  },
  {
    hostel_name: 'Urban Suits',
    contacts: '0718921088',
    payments: 'Paybill 460871 A/C EA018',
  },
  {
    hostel_name: 'Mimshack Students Residence',
    contacts: '0724693216',
    payments: 'Paybill 303030, Acc. 2033420091 ABSA',
  },
  {
    hostel_name: 'Arch Bishop Kirima (Ladies Hostel)',
    contacts: '0721611281',
    payments: 'A/C 0110268693174; Paybill 247247; Acc. 288222 #Bed Code',
  },
  {
    hostel_name: 'Grace Apartment',
    contacts: '0795580924, 0753844727',
    payments: 'A/C 0100561768001, Name: Cate Holdings',
  },
  {
    hostel_name: 'Purple House',
    contacts: '0141663686',
    payments: 'Paybill 522533, Ac. 8022184',
  },
  {
    hostel_name: 'Wisdom Suites Hostel',
    contacts: '0722274497',
    payments: 'Paybill 522522, Ac. 7982692',
  },
  {
    hostel_name: 'Warmu Apartment',
    contacts: '0722489642',
    payments: 'Paybill 541900, Ac. B048799 #Rm.No.',
  },
  {
    hostel_name: 'Emma Apartment',
    contacts: '0706409650',
    payments: 'Paybill 4037293, A/C Room No.',
  },
  {
    hostel_name: 'Mt. Kenya Hostel',
    contacts: '0726969255',
    payments: 'Paybill 880100, Ac. 072121',
  },
  {
    hostel_name: 'Achievers Hostel Ltd',
    contacts: '0742964281',
    payments: 'KCB 522522 Ac. 5975215; Equity 247247 Ac. 835300',
  },
  {
    hostel_name: 'Mumford Hostel',
    contacts: '0791039446',
    payments: 'Equity 0270164893999',
  },
  {
    hostel_name: 'Stepna Hostel',
    contacts: '0723753475',
    payments: 'Equity Acc. 0080195018500',
  },
  {
    hostel_name: 'Ngepo Apartment',
    contacts: '0701194407',
    payments: '247247 Ac. 399135',
  },
  {
    hostel_name: 'Imani Insuit Hostel',
    contacts: '0702727710, 0725509720',
    payments: 'Paybill 222111, Acc 846451',
  },
  {
    hostel_name: 'Elegant Hostel',
    contacts: '0728543703',
    payments: '0110166490057 Equity Bank',
  },
  {
    hostel_name: 'Stoneville Hostel',
    contacts: '0728543703',
    payments: '0110166490057 Equity Bank',
  },
  {
    hostel_name: 'Amazing Grace',
    contacts: '0724072020',
    payments: '055000045413 Family Bank',
  },
  {
    hostel_name: 'Tamaal Hostel A',
    contacts: '0726176330',
    payments: 'Paybill 247247 Ac. 758362',
  },
  {
    hostel_name: 'Tamaal Hostel B',
    contacts: '0726176330',
    payments: 'Paybill 247247 Ac. 758362',
  },
  {
    hostel_name: 'Lolan Hub Scholars',
    contacts: '0722160189',
    payments: 'Paybill 400200, Acc. 01148232809000',
  },
  {
    hostel_name: 'Samrice Hostel',
    contacts: '0722370937',
    payments: 'Paybill 400200, Acc. 1774161#Name',
  },
  {
    hostel_name: 'Der Comfort',
    contacts: '0724686064',
    payments: 'Till: 522522, Acc. 6017791 RM No.',
  },
  {
    hostel_name: 'Grand Hostel',
    contacts: '0711728143',
    payments: 'Paybill 247247 A/c 6020814',
  },
  {
    hostel_name: 'Kens Hostel',
    contacts: '0791863678',
    payments: 'Paybill 522522, KCB Till 02081',
  },
  {
    hostel_name: 'Popular Hostel',
    contacts: '0721727254',
    payments: '055000023641 Family Bank',
  },
  {
    hostel_name: 'Heaven on Earth',
    contacts: '0728543703',
    payments: 'Acc. 0110166490057 Family Bank',
  },
  {
    hostel_name: 'Muruguru Hostel',
    contacts: '0721300959',
    payments: 'Acc. 1730174420929 Equity Bank',
  },
  {
    hostel_name: 'Paradise Hostel',
    contacts: '0710905822',
    payments: 'Paybill 400222 Ac. 1062440#',
  },
  {
    hostel_name: 'Chairmans Hostel',
    contacts: '0720370925',
    payments: 'Paybill 247247 Ac. 0720370925 (Landlord)',
  },
  {
    hostel_name: 'Baraka Hostel',
    contacts: '0790396326',
    payments: '247247 Acc. 453700#room No.',
  },
  {
    hostel_name: 'Allexandria',
    contacts: '0707803616, 0714447933',
    payments: 'ABSA Paybill 0707803616, Acc. 2035024320',
  },
  {
    hostel_name: 'Pearls Gates',
    contacts: '0721866056',
    payments: 'Florence Kabui (Landlady)',
  },
  {
    hostel_name: 'Paresi Hostels',
    contacts: '0748879159',
    payments: 'Paybill 625625 Acc. 0125712434100',
  },
  {
    hostel_name: 'Shirikisho Hostel',
    contacts: '0713889599',
    payments: 'Acc. 01109379837900 Co-operative',
  },
  {
    hostel_name: 'Ngamia',
    contacts: '0729303782',
    payments: 'Agatha Njeri (Landlord), 0721527355',
  },
  {
    hostel_name: 'Mwalimu Hostel',
    contacts: '0728675316 (Landlord)',
    payments: 'Mpesa 0728675316, Francis Maina',
  },
  {
    hostel_name: 'Carls Hostel',
    contacts: '0726530269',
    payments: 'Highrise Agent',
  },
  {
    hostel_name: 'Glian Hostel',
    contacts: '0726530269',
    payments: 'Paybill 247247 A/C 0722515462',
  },
  {
    hostel_name: 'Kathy Hostel',
    contacts: '0721990754',
    payments: '0721990754, Douglas Munge',
  },
  {
    hostel_name: 'M & M Ladies Hostel',
    contacts: '0722356852',
    payments: '0722356852 (Landlady)',
  },
  {
    hostel_name: 'Joyce Mbogo',
    contacts: '0722639416',
    payments: '0722639416 (Landlady)',
  },
  {
    hostel_name: 'Vivians Hostel',
    contacts: '0723670077',
    payments: '0723670077 (Landlady)',
  },
  {
    hostel_name: 'Angies Hostel',
    contacts: '0726451805',
    payments: 'Equity Acc. 0600291364006',
  },
  {
    hostel_name: 'Solid 4 (Gents)',
    contacts: '0720490033',
    payments: '508400-Acc. 10061301000042',
  },
  {
    hostel_name: 'Selene Hostel',
    contacts: '0722632527',
    payments: 'Biashara Sacco 0326-41-15664',
  },
  {
    hostel_name: 'Florida Hostel',
    contacts: '0725744312',
    payments: 'Equity 1150177484084',
  },
  {
    hostel_name: "Autum's Hostel Gents",
    contacts: '0721458070',
    payments: 'Paybill 400300, Acc. 6432-08-23082',
  },
  {
    hostel_name: 'Lush Corner',
    contacts: '0721426707',
    payments: 'KCB 522522 Ac. 7570827',
  },
  {
    hostel_name: 'Kings & Queens',
    contacts: '0746050532',
    payments: '0799536591 (Landlady)',
  },
  {
    hostel_name: 'Purple Gardens Hostel',
    contacts: '0728543703',
    payments: 'Ac. 01101664957',
  },
  {
    hostel_name: 'Mid-black',
    contacts: '0728543703',
    payments: 'Ac. 0110166490057',
  },
  {
    hostel_name: 'El Shaddai Hostel',
    contacts: '0721719939',
    payments: 'Paybill 247247 A/c 719939',
  },
  {
    hostel_name: 'Crystal Hostel',
    contacts: '0728543703',
    payments: 'Acc. Equity 0110166490057',
  },
  {
    hostel_name: 'Red Marple Court',
    contacts: '0700647172',
    payments: '0758028398 (Landlady)',
  },
  {
    hostel_name: 'Eagles Hostel',
    contacts: '0723165589, 0720500496',
    payments: 'Acc. 0110100180262',
  },
  {
    hostel_name: 'Riverside Hostel',
    contacts: '0741134010',
    payments: 'Paybill 247247 Acc. 0741134010',
  },
  {
    hostel_name: 'Njetika Hostels',
    contacts: '0721270473',
    payments: '9417765',
  },
  {
    hostel_name: 'Evergreen Hostel',
    contacts: '0791550984',
    payments: 'Paybill 247247 Ac. 568317',
  },
  {
    hostel_name: 'Uzima Hostel',
    contacts: '0780758544',
    payments: 'Paybill 522533 Ac. 7739714',
  },
  {
    hostel_name: 'St. Joseph Hostel',
    contacts: '0722771084',
    payments: 'Paybill 400300-00754',
  },
  {
    hostel_name: 'Alwake',
    contacts: '0722401961',
    payments: '0722401961 (Landlord)',
  },
  {
    hostel_name: 'Pride Hostel',
    contacts: '0740491208',
    payments: 'Acc. Equity A/C 1150179545788',
  },
  {
    hostel_name: 'Veterans Hostels',
    contacts: '0743906999, 0711602845',
    payments: 'Paybill 247247, A/C 0420183069720',
  },
  {
    hostel_name: 'Blessed Anne',
    contacts: '0721452058',
    payments: 'Paybill 247247 A/c 0721452058',
  },
  {
    hostel_name: 'Flang Investment',
    contacts: '0722636816',
    payments: '0722636816 (Landlady)',
  },
  {
    hostel_name: 'Pauline Gakenia',
    contacts: '0721827777',
    payments: '0721827777 (Landlady)',
  },
  {
    hostel_name: 'Charity Wachira',
    contacts: '0722623966',
    payments: '0722623966 (Landlady)',
  },
  {
    hostel_name: 'Mary W. Wamugunda',
    contacts: '0721433851',
    payments: 'Paybill 100900 A/C 07002928',
  },
  {
    hostel_name: 'Baru Hostel',
    contacts: '0728543703',
    payments: 'Acc. Equity 0110166490057',
  },
  {
    hostel_name: 'Forest View Hostel',
    contacts: '0720452702',
    payments: 'Mpesa 0720452702',
  },
  {
    hostel_name: 'Valley Creek Hostel',
    contacts: '0740671690',
    payments: 'Paybill 972901',
  },
  {
    hostel_name: 'Dios Aumentara Place',
    contacts: '0797844116',
    payments: '0797844116 (Landlady)',
  },
  {
    hostel_name: 'Zion City Hostel',
    contacts: '0702276550',
    payments: 'Till: 5644093',
  },
  {
    hostel_name: 'Sunset Apartment',
    contacts: '0723447638',
    payments: 'Paybill 400222 A/C 08126#',
  },
  {
    hostel_name: 'Jowa Investment',
    contacts: '0724348119',
    payments: 'Paybill 111999',
  },
  {
    hostel_name: 'Baraka Hostels',
    contacts: '0113065235',
    payments: 'Acc. 1150171385230 Equity',
  },
  {
    hostel_name: 'Eunice Ladies Hostels',
    contacts: '0721322172',
    payments: 'Till: 5415631',
  },
  {
    hostel_name: 'Rosalia Wairimu',
    contacts: '0721645975',
    payments: '0721645975 (Landlady)',
  },
  {
    hostel_name: 'Jostey Hostel',
    contacts: '0748665756, 0725823237',
    payments: 'Paybill 111999 A/C 01005150044482',
  },
  {
    hostel_name: "Stacy's Hostels",
    contacts: '0781127803',
    payments: '0720994270 (Landlady)',
  },
  {
    hostel_name: 'Gateway Shelter',
    contacts: '0711486252',
    payments: 'Paybill 4022985 Acc. 023008685582910',
  },
  {
    hostel_name: 'Edgeview Heights',
    contacts: '0727650200, 0722357522',
    payments: 'Paybill 303030 A/c 0303007253',
  },
  {
    hostel_name: 'New City',
    contacts: '0723212446',
    payments: '0723212446 (Landlord)',
  },
  {
    hostel_name: 'Yachonan',
    contacts: '0725311504',
    payments: '0725311504 (Landlord)',
  },
  {
    hostel_name: 'Kwa Josiah',
    contacts: '0720573323',
    payments: '0720573323 (Landlord)',
  },
] as const;

async function main() {
  const { data: listings, error: listError } = await supabase
    .from('listings')
    .select(
      'id, title, description, price, location, county, area, slug, landlord_phone, mpesa_details, is_active, agent_id, agents(id, name, phone, whatsapp, verified, slug)',
    )
    .order('created_at', { ascending: true });

  if (listError) throw listError;

  const reviewRows: Array<Record<string, unknown>> = [];
  const phoneIndex = new Map<string, { id: string; title: string }[]>();
  const officialPhoneIndex = new Map<string, string[]>();
  const matchedListingIds = new Set<string>();

  // Build index of phones from Rumia listings
  for (const listing of listings || []) {
    const listingPhones = new Set<string>();
    if (listing.landlord_phone) {
      listingPhones.add(normalizePhone(listing.landlord_phone));
    }
    const agent = Array.isArray(listing.agents) ? listing.agents[0] : listing.agents;
    if (agent?.phone) {
      listingPhones.add(normalizePhone(agent.phone));
    }
    if (agent?.whatsapp) {
      listingPhones.add(normalizePhone(agent.whatsapp));
    }

    for (const normalizedPhone of listingPhones) {
      if (!normalizedPhone) continue;
      const bucket = phoneIndex.get(normalizedPhone) ?? [];
      bucket.push({ id: listing.id, title: listing.title });
      phoneIndex.set(normalizedPhone, bucket);
    }
  }

  // Build index of phones from official records to detect shared contacts across official records
  for (const record of officialRecords) {
    const parsed = parseOfficialRecord(record);
    for (const contact of parsed.contacts) {
      const bucket = officialPhoneIndex.get(contact) ?? [];
      bucket.push(record.hostel_name);
      officialPhoneIndex.set(contact, bucket);
    }
  }

  for (const record of officialRecords) {
    const parsed = parseOfficialRecord(record);
    const matchCandidates = (listings || []).map((listing) => {
      const listingContacts = [
        listing.landlord_phone,
        (listing.agents as any)?.phone,
        (listing.agents as any)?.whatsapp,
      ]
        .filter(Boolean)
        .map((value) => normalizePhone(value as string));

      return {
        id: listing.id,
        title: listing.title,
        landlord_phone: listing.landlord_phone,
        listing,
        contacts: listingContacts,
      };
    });

    let bestMatch = null as {
      listing: {
        id: string;
        title: string;
        landlord_phone?: string | null;
        listing: any;
        contacts: string[];
      };
      result: any;
    } | null;

    for (const candidate of matchCandidates) {
      const hasPhoneMatch = parsed.contacts.some((contact) =>
        candidate.contacts.includes(contact),
      );
      const result = matchOfficialRecordToListing(parsed, candidate);

      if (hasPhoneMatch) {
        const phoneMatchedResult = {
          ...result,
          matched: true,
          matchReason: 'phone' as const,
          requiresManualReview: false,
        };
        if (!bestMatch || bestMatch.result.matchReason !== 'phone') {
          bestMatch = { listing: candidate, result: phoneMatchedResult };
        }
        continue;
      }

      if (
        result.matched &&
        (!bestMatch ||
          (result.matchReason === 'phone' &&
            bestMatch.result.matchReason !== 'phone'))
      ) {
        bestMatch = { listing: candidate, result };
      }
    }

    if (bestMatch) {
      matchedListingIds.add(bestMatch.listing.id);
    }

    const reviewRow = {
      row_type: 'dekut_official_record',
      official_hostel_name: record.hostel_name,
      official_contacts: record.contacts,
      official_payments: record.payments,
      verified_status: bestMatch ? true : false,
      verification_source: 'DeKUT Official Housing List',
      matched_rumia_listing: bestMatch
        ? {
            id: bestMatch.listing.listing.id,
            title: bestMatch.listing.listing.title,
            slug: bestMatch.listing.listing.slug,
            location: bestMatch.listing.listing.location,
            county: bestMatch.listing.listing.county,
            area: bestMatch.listing.listing.area,
            price: bestMatch.listing.listing.price,
            is_active: bestMatch.listing.listing.is_active,
            landlord_phone: bestMatch.listing.listing.landlord_phone,
            mpesa_details: bestMatch.listing.listing.mpesa_details,
            agent_id: bestMatch.listing.listing.agent_id,
          }
        : null,
      rumia_agent: bestMatch
        ? {
            id: (bestMatch.listing.listing.agents as any)?.id ?? null,
            name: (bestMatch.listing.listing.agents as any)?.name ?? null,
            phone: (bestMatch.listing.listing.agents as any)?.phone ?? null,
            whatsapp: (bestMatch.listing.listing.agents as any)?.whatsapp ?? null,
            verified: (bestMatch.listing.listing.agents as any)?.verified ?? null,
            slug: (bestMatch.listing.listing.agents as any)?.slug ?? null,
          }
        : null,
      flags: [] as string[],
    };

    if (!bestMatch) {
      reviewRow.flags.push('official_record_no_listing');
    }

    if (parsed.contacts.length > 1) {
      reviewRow.flags.push('multiple_payment_methods_detected');
    }

    if (bestMatch && bestMatch.result.requiresManualReview) {
      reviewRow.flags.push('manual_name_match_review');
    }

    // Check for shared contacts in Rumia listings
    const sharedContactsInRumia = parsed.contacts.filter((contact) =>
      phoneIndex.has(contact),
    );
    // Check for shared contacts across official records
    const sharedContactsInOfficial = parsed.contacts.filter((contact) => {
      const hostels = officialPhoneIndex.get(contact);
      return hostels && hostels.length > 1;
    });

    if (sharedContactsInRumia.length > 0 || sharedContactsInOfficial.length > 0) {
      reviewRow.flags.push('shared_contact_detected');
    }

    reviewRows.push(reviewRow);
  }

  for (const listing of listings || []) {
    if (matchedListingIds.has(listing.id)) {
      continue;
    }

    reviewRows.push({
      row_type: 'rumia_listing_only',
      official_hostel_name: null,
      official_contacts: null,
      official_payments: null,
      verified_status: false,
      verification_source: 'Rumia listing only',
      matched_rumia_listing: {
        id: listing.id,
        title: listing.title,
        slug: listing.slug,
        location: listing.location,
        county: listing.county,
        area: listing.area,
        price: listing.price,
        is_active: listing.is_active,
        landlord_phone: listing.landlord_phone,
        mpesa_details: listing.mpesa_details,
        agent_id: listing.agent_id,
      },
      rumia_agent: {
        id: (listing.agents as any)?.id ?? null,
        name: (listing.agents as any)?.name ?? null,
        phone: (listing.agents as any)?.phone ?? null,
        whatsapp: (listing.agents as any)?.whatsapp ?? null,
        verified: (listing.agents as any)?.verified ?? null,
        slug: (listing.agents as any)?.slug ?? null,
      },
      flags: ['rumia_listing_no_official_match'],
    });
  }

  const reportPath = path.join(
    process.cwd(),
    'supabase',
    'dekut-verification-review.json',
  );
  fs.writeFileSync(reportPath, JSON.stringify(reviewRows, null, 2));
  console.log(`Wrote ${reviewRows.length} review rows to ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
