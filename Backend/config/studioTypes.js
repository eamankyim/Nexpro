/**
 * Studio Type Configuration
 *
 * Defines default categories and options for each studio type.
 * Studio types use the Job/Quote/Invoice flow (like printing press).
 */

const STUDIO_TYPES = {
  printing_press: {
    name: 'Printing Press',
    materialTypes: [
      'Plain Paper',
      'Photo Paper',
      'SAV (Self-Adhesive Vinyl)',
      'Banner',
      'One Way Vision',
      'Canvas',
      'Cardstock',
      'Sticker Paper',
      'Vinyl',
      'Foam Board',
      'Corrugated Board',
      'Bond Paper',
      'Glossy Paper',
      'Matte Paper',
      'Satin Paper',
      'Transparent Vinyl',
      'Mesh Material',
      'Fabric',
      'Other'
    ],
    defaultCategories: [
      { name: 'Paper & Substrates', description: 'Paper stocks, vinyl, canvas, label materials' },
      { name: 'Plates & Screens', description: 'Offset plates, screen mesh, stencil supplies' },
      { name: 'Inks & Toners', description: 'Process inks, toners, UV inks' },
      { name: 'Coatings & Laminates', description: 'Varnishes, laminating films, protective finishes' },
      { name: 'Binding & Finishing', description: 'Binding, laminating, finishing supplies' },
      { name: 'Packaging & Shipping', description: 'Boxes, envelopes, tapes, packaging materials' },
      { name: 'Digital Printing Media', description: 'Signage media, fabric substrates' },
      { name: 'Design Services', description: 'Design and custom work' }
    ]
  },
  mechanic: {
    name: 'Mechanic / Auto Repair',
    materialTypes: [
      'OEM Parts',
      'Aftermarket Parts',
      'Fluids',
      'Filters',
      'Belts & Hoses',
      'Brake Pads',
      'Tires',
      'Batteries',
      'Other'
    ],
    defaultCategories: [
      { name: 'Repairs', description: 'General repairs and diagnostics' },
      { name: 'Oil Change', description: 'Oil and filter changes' },
      { name: 'Brake Service', description: 'Brake pads, rotors, and brake fluid' },
      { name: 'Diagnostics', description: 'Vehicle diagnostics and inspections' },
      { name: 'Suspension & Steering', description: 'Shocks, struts, steering components' },
      { name: 'Electrical', description: 'Battery, alternator, electrical repairs' },
      { name: 'Parts', description: 'Parts and components' },
      { name: 'Other Services', description: 'Miscellaneous repair services' }
    ]
  },
  barber: {
    name: 'Barber',
    materialTypes: [
      'Hair Products',
      'Styling Products',
      'Shaving Supplies',
      'Disposables',
      'Other'
    ],
    defaultCategories: [
      { name: 'Haircuts', description: 'Hair cutting services' },
      { name: 'Beard Trim', description: 'Beard and facial hair grooming' },
      { name: 'Styling', description: 'Hair styling and treatments' },
      { name: 'Shaves', description: 'Traditional shaves and hot towel service' },
      { name: 'Coloring', description: 'Hair coloring and highlights' },
      { name: 'Other Services', description: 'Miscellaneous grooming services' }
    ]
  },
  salon: {
    name: 'Salon',
    materialTypes: [
      'Hair Products',
      'Color Products',
      'Nail Products',
      'Skincare',
      'Styling Products',
      'Disposables',
      'Other'
    ],
    defaultCategories: [
      { name: 'Haircuts', description: 'Hair cutting services' },
      { name: 'Coloring', description: 'Hair coloring and highlights' },
      { name: 'Treatments', description: 'Hair and scalp treatments' },
      { name: 'Styling', description: 'Hair styling and blowouts' },
      { name: 'Nails', description: 'Manicure and pedicure services' },
      { name: 'Skincare', description: 'Facials and skincare treatments' },
      { name: 'Other Services', description: 'Miscellaneous salon services' }
    ]
  }
};

const getStudioTypeConfig = (studioType) => {
  return STUDIO_TYPES[studioType] || null;
};

const getStudioTypeOptions = () => {
  return Object.entries(STUDIO_TYPES).map(([key, config]) => ({
    key,
    name: config.name
  }));
};

const getDefaultCategoriesForStudioType = (studioType) => {
  const config = getStudioTypeConfig(studioType);
  return config ? config.defaultCategories : [];
};

const getMaterialTypesForStudioType = (studioType) => {
  const config = getStudioTypeConfig(studioType);
  return config?.materialTypes || ['Other'];
};

module.exports = {
  STUDIO_TYPES,
  getStudioTypeConfig,
  getStudioTypeOptions,
  getDefaultCategoriesForStudioType,
  getMaterialTypesForStudioType
};
