<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    public function definition(): array
    {
        return [
            'username'     => fake()->unique()->userName(),
            'password'     => Hash::make('password'),
            'role'         => fake()->randomElement(['agent', 'manager']),
            'display_name' => fake()->name(),
            'first_name'   => fake()->firstName(),
            'last_name'    => fake()->lastName(),
            'email'        => fake()->unique()->safeEmail(),
            'phone'        => fake()->phoneNumber(),
            'is_active'    => 1,
        ];
    }
}
