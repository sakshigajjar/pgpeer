// Canonical list of Indian states + top cities for the PG dropdowns.
//
// MUST stay in sync with src/config/locations.js on the backend — if a value
// exists here but not on the backend, submissions will 400 with "invalid
// state/city"; if it exists on the backend but not here, users can't select
// it from the dropdown. Two files, one source of truth by convention.
//
// Format is ESM here (frontend is "type": "module") vs CommonJS on the
// backend — arrays themselves are identical.


// -----------------------------------------------------------------------
// STATES — 28 states + 8 UTs, one flat alphabetical array (36 total).
// -----------------------------------------------------------------------

export const STATES = [
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
// CITIES — ~50 cities across the top metros and tier-1/tier-2 markets.
// Each entry carries its state so the frontend can cascade.
// -----------------------------------------------------------------------

export const CITIES = [
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
// View helpers.
// -----------------------------------------------------------------------

// Returns the CITIES entries for a given state, preserving alphabetical order.
// Used by the State → City cascading dropdown on AddPgPage and SearchPage.
// Empty string or unknown state → empty array (dropdown just shows nothing).
export function citiesForState(state) {
  if (!state) return []
  return CITIES.filter((c) => c.state === state)
}