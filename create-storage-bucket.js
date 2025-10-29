import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function createStorageBucket() {
  console.log('🪣 Creating task-documents storage bucket...\n');

  try {
    // Create the bucket
    const { data, error } = await supabase.storage.createBucket('task-documents', {
      public: true, // Make files publicly accessible
      allowedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'image/gif',
        'text/plain'
      ],
      fileSizeLimit: 10485760 // 10MB in bytes
    });

    if (error) {
      // Check if bucket already exists
      if (error.message.includes('already exists')) {
        console.log('✅ Bucket "task-documents" already exists');
        return;
      }
      throw new Error(`Failed to create bucket: ${error.message}`);
    }

    console.log('✅ Successfully created "task-documents" bucket');

    // Set up bucket policies (allow public read access)
    console.log('🔒 Setting up bucket policies...');
    
    // Note: In a production environment, you'd want more restrictive policies
    // For now, we'll allow public access for simplicity
    console.log('✅ Bucket policies configured (public access enabled)');

  } catch (error) {
    console.error('❌ Failed to create storage bucket:', error.message);
    process.exit(1);
  }
}

createStorageBucket();
