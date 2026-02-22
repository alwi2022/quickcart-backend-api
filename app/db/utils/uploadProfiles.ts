type UploadContext = {
  ref: string;
};

type UploadProfile = {
  folder: string;
  mode: 'single' | 'multiple';
  eager: string;
  buildPublicId?: (ctx: UploadContext) => string;
  overwrite?: boolean;
};

export const uploadProfiles: Record<'category' | 'product', UploadProfile> = {
  category: {
    folder: process.env.CLOUDINARY_CATEGORIES_FOLDER || 'galatech/categories',
    mode: 'single',
    eager: 'f_auto,q_auto:eco,c_fill,w_600,h_600',
    buildPublicId: ({ ref }) => `cat-${ref}`,
    overwrite: true,
  },
  product: {
    folder: process.env.CLOUDINARY_PRODUCTS_FOLDER || 'galatech/products',
    mode: 'multiple',
    eager: 'f_auto,q_auto:good',
  },
};
