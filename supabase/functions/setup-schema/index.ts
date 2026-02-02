import { Pool } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';

const databaseUrl = Deno.env.get('SUPABASE_DB_URL')!;
const pool = new Pool(databaseUrl, 3, true);

Deno.serve(async (req) => {
    try {
        const connection = await pool.connect();
        try {
            console.log("Connected to DB. Creating tables...");

            // 1. print_flyers
            await connection.queryObject`
        create table if not exists print_flyers (
          id uuid default gen_random_uuid() primary key,
          format text not null,
          paper text not null,
          quantity integer not null,
          price_dkk numeric not null,
          created_at timestamp with time zone default timezone('utc'::text, now()) not null,
          unique(format, paper, quantity)
        );
      `;
            // Enable RLS for flyers
            await connection.queryObject`alter table print_flyers enable row level security;`;
            // Policies (Drop first to avoid error if exists? Or Create if not exists logic difficult in raw sql without block.
            // We can use 'create policy if not exists' is not standard PG.
            // We will perform a check or just assume it might fail if exists (catch error).
            // Or simplify: just create table. Policies usually stick.
            // I'll wrap policies in try/catch blocks via separate queries or ignore errors.

            const createPolicy = async (sql: string) => {
                try { await connection.queryObject(sql); } catch (e) { console.log("Policy error (maybe exists):", e.message); }
            };

            await createPolicy(`create policy "Public Read Flyer" on print_flyers for select using (true)`);
            await createPolicy(`create policy "Admin Write Flyer" on print_flyers for insert with check (exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin'))`);
            await createPolicy(`create policy "Admin Update Flyer" on print_flyers for update using (exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin'))`);
            await createPolicy(`create policy "Admin Delete Flyer" on print_flyers for delete using (exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin'))`);


            // 2. folder_prices
            await connection.queryObject`
        create table if not exists folder_prices (
            id uuid default gen_random_uuid() primary key,
            format text not null,
            paper text not null,
            fold_type text not null,
            quantity integer not null,
            price_dkk numeric not null,
             unique(format, paper, fold_type, quantity)
        );
      `;
            await connection.queryObject`alter table folder_prices enable row level security;`;
            await createPolicy(`create policy "Public Read Folder" on folder_prices for select using (true)`);
            await createPolicy(`create policy "Admin Write Folder" on folder_prices for insert with check (exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin'))`);
            await createPolicy(`create policy "Admin Update Folder" on folder_prices for update using (exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin'))`);

            // 3. generic_product_prices
            await connection.queryObject`
        create table if not exists generic_product_prices (
            id uuid default gen_random_uuid() primary key,
            product_id uuid not null references products(id) on delete cascade,
            variant_name text not null,
            variant_value text not null,
            quantity integer not null,
            price_dkk numeric not null,
             unique(product_id, variant_name, variant_value, quantity)
        );
      `;
            await connection.queryObject`alter table generic_product_prices enable row level security;`;
            await createPolicy(`create policy "Public Read Generic" on generic_product_prices for select using (true)`);
            await createPolicy(`create policy "Admin Write Generic" on generic_product_prices for insert with check (exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin'))`);
            await createPolicy(`create policy "Admin Update Generic" on generic_product_prices for update using (exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin'))`);
            await createPolicy(`create policy "Admin Delete Generic" on generic_product_prices for delete using (exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin'))`);

            // 3. Reload PostgREST Schema Cache
            console.log("Reloading schema cache...");
            await connection.queryObject("NOTIFY pgrst, 'reload schema'");

            console.log("Schema updated successfully.");
        } finally {
            connection.release();
        }
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        console.error("Schema Setup Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
});
