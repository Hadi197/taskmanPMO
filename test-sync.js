import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testDataSync() {
  console.log('🔄 Testing Data Synchronization with Supabase...\n');

  try {
    // Test 1: Read boards
    console.log('1️⃣ Testing Boards Read...');
    const { data: boards, error: boardsError } = await supabase
      .from('boards')
      .select('*')
      .order('created_at', { ascending: false });

    if (boardsError) throw new Error(`Boards read failed: ${boardsError.message}`);
    console.log(`✅ Found ${boards.length} boards: ${boards.map(b => b.name).join(', ')}`);

    // Test 2: Read tasks for first board
    if (boards.length > 0) {
      console.log('\n2️⃣ Testing Tasks Read...');
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('board_id', boards[0].id)
        .order('created_at', { ascending: false });

      if (tasksError) throw new Error(`Tasks read failed: ${tasksError.message}`);
      console.log(`✅ Found ${tasks.length} tasks in "${boards[0].name}": ${tasks.map(t => t.title).join(', ')}`);
    }

    // Test 3: Read sub_sub_tasks
    console.log('\n3️⃣ Testing Sub-Sub-Tasks Read...');
    const { data: subSubTasks, error: subSubError } = await supabase
      .from('sub_sub_task')
      .select('*')
      .order('created_at', { ascending: false });

    if (subSubError) throw new Error(`Sub-sub-tasks read failed: ${subSubError.message}`);
    console.log(`✅ Found ${subSubTasks.length} sub-sub-tasks`);

    // Test 4: Read team members
    console.log('\n4️⃣ Testing Team Members Read...');
    const { data: teamMembers, error: teamError } = await supabase
      .from('team_members')
      .select('*')
      .order('name');

    if (teamError) throw new Error(`Team members read failed: ${teamError.message}`);
    console.log(`✅ Found ${teamMembers.length} team members: ${teamMembers.map(m => m.name).join(', ')}`);

    // Test 5: Test write operation (create a test task)
    console.log('\n5️⃣ Testing Write Operation...');
    const testTask = {
      board_id: boards[0].id,
      title: `Test Task - ${new Date().toISOString()}`,
      status: 'Not Started',
      priority: 'Low'
    };

    const { data: newTask, error: createError } = await supabase
      .from('tasks')
      .insert([testTask])
      .select()
      .single();

    if (createError) throw new Error(`Task creation failed: ${createError.message}`);
    console.log(`✅ Successfully created test task: "${newTask.title}"`);

    // Test 6: Test update operation
    console.log('\n6️⃣ Testing Update Operation...');
    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update({ status: 'Working on it' })
      .eq('id', newTask.id)
      .select()
      .single();

    if (updateError) throw new Error(`Task update failed: ${updateError.message}`);
    console.log(`✅ Successfully updated task status to: "${updatedTask.status}"`);

    // Test 7: Test delete operation (cleanup)
    console.log('\n7️⃣ Testing Delete Operation...');
    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', newTask.id);

    if (deleteError) throw new Error(`Task deletion failed: ${deleteError.message}`);
    console.log(`✅ Successfully deleted test task`);

    // Test 8: Test hierarchical data relationships
    console.log('\n8️⃣ Testing Hierarchical Relationships...');
    if (subSubTasks.length > 0) {
      const subTask = subSubTasks[0];
      const { data: parentTask, error: parentError } = await supabase
        .from('tasks')
        .select('title')
        .eq('id', subTask.task_id)
        .single();

      if (parentError) throw new Error(`Parent task lookup failed: ${parentError.message}`);
      console.log(`✅ Sub-task "${subTask.title}" belongs to task "${parentTask.title}"`);
    }

    console.log('\n🎉 All synchronization tests passed! Data is properly synchronized with Supabase.');

  } catch (error) {
    console.error('\n❌ Synchronization test failed:', error.message);
    process.exit(1);
  }
}

testDataSync();
