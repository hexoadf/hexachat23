const supabase = require('./database');

const BUCKETS = {
  avatars: 'avatars',
  media: 'media',
  status: 'status',
  groups: 'groups'
};

async function uploadFile(bucket, filePath, fileBuffer, contentType) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, fileBuffer, {
      contentType,
      upsert: true,
      cacheControl: '3600'
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
}

async function deleteFile(bucket, filePath) {
  const { error } = await supabase.storage.from(bucket).remove([filePath]);
  if (error) throw error;
}

function getPublicUrl(bucket, path) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

module.exports = { BUCKETS, uploadFile, deleteFile, getPublicUrl };
