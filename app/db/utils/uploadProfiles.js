// app/lib/uploadProfiles.js
export const uploadProfiles = {
  category: {
    folder: process.env.CLOUDINARY_CATEGORIES_FOLDER || 'galatech/categories',
    mode: 'single', // 1 slot saja
    eager: 'f_auto,q_auto:eco,c_fill,w_600,h_600',
    buildPublicId: ({ ref }) => `cat-${ref}`, // ref = slug/id kategori
    overwrite: true,
  },
  product: {
    folder: process.env.CLOUDINARY_PRODUCTS_FOLDER || 'galatech/products',
    mode: 'multiple', // banyak gambar
    eager: 'f_auto,q_auto:good',
    // public_id tidak ditentukan → auto unik per file
  },
};
