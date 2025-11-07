// src/controllers/placeController.js
import { supabase } from '../services/supabaseClient.js';

export const addPlace = async (req, res, next) => {
  try {
    const { trip_id, name, description, location } = req.body;
    const username = req.user.username;

    // Verify access to trip
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('group_id')
      .eq('id', trip_id)
      .maybeSingle();

    if (tripError) throw tripError;
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Verify membership
    const { data: membership } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', trip.group_id)
      .eq('username', username)
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    let photo_url = null;
    if (req.file) {
      // Upload to Supabase Storage
      const fileExt = req.file.originalname.split('.').pop();
      const fileName = `${trip_id}/${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('places-photos')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('places-photos')
        .getPublicUrl(fileName);

      photo_url = publicUrl;
    }

    const { data, error } = await supabase
      .from('places_visited')
      .insert([{ trip_id, name, description, location, photo_url, created_by: username }])
      .select();

    if (error) throw error;
    res.status(201).json({ message: 'Place added successfully', place: data[0] });
  } catch (err) {
    next(err);
  }
};

export const getTripPlaces = async (req, res, next) => {
  try {
    const { trip_id } = req.params;
    const username = req.user.username;

    // Verify access
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('group_id')
      .eq('id', trip_id)
      .maybeSingle();

    if (tripError) throw tripError;
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const { data: membership } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', trip.group_id)
      .eq('username', username)
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    // Get trip members to filter places
    const { data: tripMembers, error: tripMemError } = await supabase
      .from('trip_members')
      .select('username')
      .eq('trip_id', trip_id);

    if (tripMemError) throw tripMemError;
    const tripMemberUsernames = new Set((tripMembers || []).map(m => m.username));

    // Get all places for the trip
    const { data: allPlaces, error: placesError } = await supabase
      .from('places_visited')
      .select('*')
      .eq('trip_id', trip_id)
      .order('visited_time', { ascending: false });

    if (placesError) throw placesError;

    // Filter places to only include those created by trip members
    const filteredPlaces = (allPlaces || []).filter(place => 
      place.created_by && tripMemberUsernames.has(place.created_by)
    );

    res.json(filteredPlaces);
  } catch (err) {
    next(err);
  }
};

export const updatePlace = async (req, res, next) => {
  try {
    const { place_id } = req.params;
    const username = req.user.username;
    const updates = req.body;

    // Get place and verify access
    const { data: place, error: placeError } = await supabase
      .from('places_visited')
      .select('trip_id, trips(group_id)')
      .eq('id', place_id)
      .maybeSingle();

    if (placeError) throw placeError;
    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    const { data: membership } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', place.trips.group_id)
      .eq('username', username)
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const { data, error } = await supabase
      .from('places_visited')
      .update(updates)
      .eq('id', place_id)
      .select();

    if (error) throw error;
    res.json({ message: 'Place updated successfully', place: data[0] });
  } catch (err) {
    next(err);
  }
};

export const deletePlace = async (req, res, next) => {
  try {
    const { place_id } = req.params;
    const username = req.user.username;

    // Get place and verify access
    const { data: place, error: placeError } = await supabase
      .from('places_visited')
      .select('trip_id, trips(group_id)')
      .eq('id', place_id)
      .maybeSingle();

    if (placeError) throw placeError;
    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    const { data: membership } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', place.trips.group_id)
      .eq('username', username)
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const { error } = await supabase.from('places_visited').delete().eq('id', place_id);
    if (error) throw error;

    res.json({ message: 'Place deleted successfully' });
  } catch (err) {
    next(err);
  }
};
