// Canonical list of Indian states + top cities for the PG dropdown.
//
// Kept in sync with frontend/src/config/locations.js — if you add a value
// here, add it there too. Both files must stay identical string-for-string
// or the frontend dropdown will offer a value the backend rejects.
//
// Why arrays, not FK reference tables:
//   36 states + ~50 cities is stable, low-cardinality data. A hard dropdown
//   is the right UI, and canonicalisation happens at INSERT time via
//   isValidState() / isValidCity(). If we ever need geo joins or per-city
//   analytics, normalise into a `cities` table with FKs then.
//
// Naming conventions:
//   - Cities use their most commonly-typed name (Bangalore, not Bengaluru;
//     Gurgaon, not Gurugram). Matches how seed data is stored.
//   - "Delhi" appears in STATES even though it's an NCT — for the dropdown
//     it's just another administrative region.


// -----------------------------------------------------------------------
// STATES — 28 states + 8 UTs, one flat alphabetical array (36 total).
// -----------------------------------------------------------------------

const STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
]


// -----------------------------------------------------------------------
// CITIES — ~50 cities covering metros + tier-1 tech/education hubs +
// tier-2 with dense PG markets. Alphabetical, each carrying its state so
// the frontend can cascade (pick a state → city dropdown filters).
// -----------------------------------------------------------------------

const CITIES = [
  { name: 'Agra',                state: 'Uttar Pradesh'   },
  { name: 'Ahmedabad',           state: 'Gujarat'         },
  { name: 'Amritsar',            state: 'Punjab'          },
  { name: 'Aurangabad',          state: 'Maharashtra'     },
  { name: 'Bangalore',           state: 'Karnataka'       },
  { name: 'Bhopal',              state: 'Madhya Pradesh'  },
  { name: 'Bhubaneswar',         state: 'Odisha'          },
  { name: 'Chandigarh',          state: 'Chandigarh'      },
  { name: 'Chennai',             state: 'Tamil Nadu'      },
  { name: 'Coimbatore',          state: 'Tamil Nadu'      },
  { name: 'Cuttack',             state: 'Odisha'          },
  { name: 'Dehradun',            state: 'Uttarakhand'     },
  { name: 'Delhi',               state: 'Delhi'           },
  { name: 'Faridabad',           state: 'Haryana'         },
  { name: 'Ghaziabad',           state: 'Uttar Pradesh'   },
  { name: 'Gurgaon',             state: 'Haryana'         },
  { name: 'Guwahati',            state: 'Assam'           },
  { name: 'Hyderabad',           state: 'Telangana'       },
  { name: 'Indore',              state: 'Madhya Pradesh'  },
  { name: 'Jaipur',              state: 'Rajasthan'       },
  { name: 'Jamshedpur',          state: 'Jharkhand'       },
  { name: 'Jodhpur',             state: 'Rajasthan'       },
  { name: 'Kanpur',              state: 'Uttar Pradesh'   },
  { name: 'Kochi',               state: 'Kerala'          },
  { name: 'Kolkata',             state: 'West Bengal'     },
  { name: 'Kota',                state: 'Rajasthan'       },
  { name: 'Lucknow',             state: 'Uttar Pradesh'   },
  { name: 'Ludhiana',            state: 'Punjab'          },
  { name: 'Madurai',             state: 'Tamil Nadu'      },
  { name: 'Mangalore',           state: 'Karnataka'       },
  { name: 'Meerut',              state: 'Uttar Pradesh'   },
  { name: 'Mumbai',              state: 'Maharashtra'     },
  { name: 'Mysore',              state: 'Karnataka'       },
  { name: 'Nagpur',              state: 'Maharashtra'     },
  { name: 'Nashik',              state: 'Maharashtra'     },
  { name: 'Noida',               state: 'Uttar Pradesh'   },
  { name: 'Panaji',              state: 'Goa'             },
  { name: 'Patna',               state: 'Bihar'           },
  { name: 'Pune',                state: 'Maharashtra'     },
  { name: 'Raipur',              state: 'Chhattisgarh'    },
  { name: 'Rajkot',              state: 'Gujarat'         },
  { name: 'Ranchi',              state: 'Jharkhand'       },
  { name: 'Shimla',              state: 'Himachal Pradesh'},
  { name: 'Surat',               state: 'Gujarat'         },
  { name: 'Thane',               state: 'Maharashtra'     },
  { name: 'Thiruvananthapuram',  state: 'Kerala'          },
  { name: 'Trichy',              state: 'Tamil Nadu'      },
  { name: 'Vadodara',            state: 'Gujarat'         },
  { name: 'Varanasi',            state: 'Uttar Pradesh'   },
  { name: 'Vijayawada',          state: 'Andhra Pradesh'  },
  { name: 'Visakhapatnam',       state: 'Andhra Pradesh'  },
]


// -----------------------------------------------------------------------
// Validation helpers used by controllers.
// -----------------------------------------------------------------------

// True iff `state` is one of the 36 canonical values.
function isValidState(state) {
  return typeof state === 'string' && STATES.includes(state)
}

// True iff `city` exists AND is paired with the correct `state`. Guards
// against a spoofed body like { state: 'Gujarat', city: 'Bangalore' }.
function isValidCity(city, state) {
  if (typeof city !== 'string' || typeof state !== 'string') return false
  return CITIES.some((c) => c.name === city && c.state === state)
}


module.exports = { STATES, CITIES, isValidState, isValidCity }